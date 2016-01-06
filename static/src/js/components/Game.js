import React, { Component } from 'react';
import navigate from 'react-router';

import GameSidebar from './gameSidebar'
import GameOverModal from './gameOverModal'


export default class Game extends Component {

  constructor (props) {
    super(props);
  }

  state =  {
    game: null,
    isReplay: false,
    isLoading: false,
    latestGameState: null
  }

  handleStart (isManual) {
    $.ajax({
      type: 'POST',
      url: '/api/games/' + this.props.gameId + '/start',
      data: JSON.stringify({ manual: isManual }),
    })
    .done((response) => {
      console.log('Started Game', response.data);
      this.setState({ game: response.data });
      this.checkInterval();
    });
  }

  handlePause () {
    $.ajax({
      type: 'PUT',
      url: '/api/games/' + this.props.gameId + '/pause'
    })
    .done((response) => {
      console.log('Paused Game', response.data);
      this.setState({ game: response.data });
    });
  }

  handleResume () {
    $.ajax({
      type: 'PUT',
      url: '/api/games/' + this.props.gameId + '/resume'
    })
    .done((response) => {
      console.log('Resumed Game', response.data);
      this.setState({ game: response.data });
      this.checkInterval();
    });
  }

  handleReplay () {
    console.log('Started Replay');
    let url = '/api/games/' + this.props.gameId + '/gamestates';

    $.ajax({
      type: 'GET',
      url: url
    })
    .done((response) => {
      let framesCompleted = 0;
      let gameStates = response.data;

      let next = function () {
        this.handleGameState(gameStates[gameStates.length - framesCompleted - 1]);
        if (++framesCompleted < response.data.length && this.state.isReplay) {
          setTimeout(next, 350);
        }
      };

      next();
    });

    this.setState({ isReplay: true });
  }

  handleCancelReplay () {
    this.setState({ isReplay: false });
  }

  handleClickNextTurn () {
    this.setState({ isLoading: true });
    $.ajax({
      type: 'POST',
      url: '/api/games/' + this.props.gameId + '/turn'
    })
    .done((response) => {
      this.handleGameState(response.data);
    });
  }

  handleGameState (gameState, ignoreEnd) {
    if (this.isMounted()) {
      console.log('GAME STATE', gameState);
      this.state.latestGameState = gameState;
      this.state.isLoading = false;

      if (gameState.is_done) {
        $('#game-summary-modal').off('shown.bs.modal').on('shown.bs.modal', function () {
          console.log('hello');
          $(this).find('button').focus();
        }).modal('show');

        this.state.isReplay = false;
        this.state.game.state = 'done';
      }

      this.setState(this.state);
    }
  }

  handleRematch () {
    this.setState({ isLoading: true });

    $.ajax({
      type: 'POST',
      url: '/api/games/' + this.props.gameId + '/rematch'
    })
    .done((response) => {
      navigate('/play/games/' + response.data._id);
      this.componentDidMount();
    }).error(function (xhr, textStatus, errorThrown) {
      this.setState({ isLoading: false });
    });
  }

  handleClickContinuous () {
    this.interval = setInterval(this.handleClickNextTurn, 400);
  }

  tick (callback) {
    let url = '/api/games/' + this.props.gameId + '/gamestates/latest';
    let id = Date.now();

    $.ajax({ type: 'GET', url: url })
    .done((response) => {
      this.handleGameState(response.data);
      callback && callback(response.data);
    });
  }

  checkInterval () {
    let _ = () => {
      let shouldTick = this.state.game.state === 'playing' ||
                       this.state.game.state === 'ready';
      if (!shouldTick) { return; }

      let startTimestamp = Date.now();
      this.tick((gameState) => {
        let endTimestamp = Date.now();
        let elapsedMillis = endTimestamp - startTimestamp;

        let sleepFor = Math.max(0, this.state.game.turn_time * 1000 - elapsedMillis);

        if (this.isMounted() && shouldTick && !gameState.is_done) {
          setTimeout(_, sleepFor);
        }

        if (gameState.is_done) {
          this.state.game.state = 'done';
          this.setState({ game: this.state.game });
        }
      });
    };

    _();
  }

  componentDidMount () {
    let canvas = this.refs.canvas;
    console.log(this.props);
    $.ajax({
      type: 'GET',
      url: '/api/games/' + this.props.gameId
    })
    .done((response) => {
      console.log(response);
      if (this.isMounted()) {
        this.setState({ game: response.data });
      }

      // Get latest game state
      this.tick(function () {
        // See if we need to tick the game
        this.checkInterval();
      });
    });
  }

  componentDidUpdate (prevProps, prevState) {
    if (!this.state.latestGameState) { return; }

    if (!this.board) {
      this.board = this.getBoard();
      this.board.init(this.state.game.width, this.state.game.height);
    }

    this.board.update(this.state.latestGameState );
  }

  getBoard () {
    let canvas = this.refs.canvas;
    let ctx = canvas.getContext('2d');
    return new Board(ctx, canvas);
  }

  render () {
    return (
      <div className="row">
        <div className="col-md-9">
          <canvas ref="canvas">Your browser does not support canvas</canvas>
        </div>
        <div className="col-md-3 sidebar">
          <GameSidebar
            gameId={this.props.gameId}
            game={this.state.game}
            isReplay={this.state.isReplay}
            isLoading={this.state.isLoading}
            latestGameState={this.state.latestGameState}
            continueous={this.handleClickContinuous}
            startAutomated={this.handleStart.bind(null, false)}
            startManual={this.handleStart.bind(null, true)}
            startReplay={this.handleReplay}
            rematch={this.handleRematch}
            cancelReplay={this.handleCancelReplay}
            pause={this.handlePause}
            resume={this.handleResume}
            nextTurn={this.handleClickNextTurn}
          />
        </div>
        <GameOverModal
          game={this.state.game}
          latestGameState={this.state.latestGameState}
        />
      </div>
    );
  }

}
