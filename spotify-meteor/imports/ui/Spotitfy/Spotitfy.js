import React, { Component } from "react";
import BasicInfo from "../BasicInfo/BasicInfo";
import PropTypes from "prop-types";
import "./Spotitfy.css";
import axios from "axios";
import { randomSamples } from "../TuneParameters/TuneParameters";
import { Meteor } from "meteor/meteor";
import { withTracker } from "meteor/react-meteor-data";
import { Sessions } from "../../api/sessions";


function shuffle( a ) {
  for ( let i = a.length - 1; i > 0; i-- ) {
    const j = Math.floor( Math.random() * (i + 1) );
    [ a[ i ], a[ j ] ] = [ a[ j ], a[ i ] ];
  }
  return a;
}

class Spotitfy extends Component {

  constructor( props ) {
    super( props );
    this.state = {
      currentTrack: props.curr_session.currentSong,
      options: [],
      actualTrack: undefined,
      disabled: false,
      loading: false
    };
    this.selectOption = this.selectOption.bind( this );
    this.timeout = undefined;
    this.stateTimeout = undefined;
  }

  componentDidMount() {
    this.next();
  }

  componentDidUpdate( prevProps ) {
    if ( prevProps.curr_session.currentSong !== this.props.curr_session.currentSong ) {
      this.next();
    }
  }

  componentWillUnmount(){
    this.timeout && clearTimeout(this.timeout);
  }

  playSongURI( uri, toggle = true, cbck ) {
    axios.put( `https://api.spotify.com/v1/me/player/${toggle ? "play" : "pause"}?device_id=${this.props.spotify_tokens.deviceID}`,
      {
        uris: [ uri ],
        position_ms: 30000 // Optional, start point
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.props.spotify_tokens.access_token}`
        }
      } )
      .then( () => {
        if ( cbck ) {
          cbck();
        }
      } );
  }

  next() {
    if ( this.state.currentTrack < this.props.curr_session.config.playlist.tracks.length ) {
      // Se que se puede mejorar, pero por tiempo...
      let opts = randomSamples( this.props.fullPlaylist.tracks.items, 4 );
      opts = opts.map( t => {
        let track = t.track.name;
        let artists = t.track.artists.map( a => a.name ).join( ", " );
        return `${track} - ${artists}`;
      } );

      const orig = this.props.fullPlaylist.tracks.items.filter( i => {
        return i.track.uri === this.props.curr_session.config.playlist.tracks[ this.state.currentTrack ].uri;
      } )[ 0 ];
      let daTrack = `${orig.track.name} - ${orig.track.artists.map( a => a.name ).join( ", " )}`;
      opts.push( daTrack );
      opts = shuffle( opts );

      this.setState({loading:true});
      this.stateTimeout && clearTimeout(this.stateTimeout);
      this.stateTimeout = setTimeout(() =>{
        this.setState( { currentTrack: this.state.currentTrack + 1, options: opts, actualTrack: daTrack, disabled: false, loading: false },
          () => {
            this.timeout && clearTimeout(this.timeout);
            this.playSongURI( this.props.curr_session.config.playlist.tracks[ this.state.currentTrack - 1 ].uri, true,
              () => {
                this.timeout = setTimeout( () => {
                  Meteor.call( "session.nextSong", this.props.curr_session.id );
                }, (this.props.curr_session.config.duration + 3) * 1000 );
              } );
          } );
      },1500);
    }
    else {
      Meteor.call( "session.endGame", this.props.curr_session.id );
      this.playSongURI(undefined, false);
    }
  }

  selectOption( t ) {
    if ( t === this.state.actualTrack ) {
      Meteor.call( "session.addPoint", this.props.curr_session.id, Meteor.user() );
    }
    else {
      this.setState( { disabled: true } );
    }
  }

  render() {

    let leader = (
      Object.keys( this.props.curr_session.users ).sort( ( a, b ) => {
        return this.props.curr_session.users[ b ].score - this.props.curr_session.users[ a ].score;
      } )
    );

    return (
      <div>
        <BasicInfo session={this.props.curr_session} changeState={this.props.changeState}/>
        <div className="gameBoard1">
          <div className="mainBoard">
            <h1 className="whiteAndCenter">
              {(this.props.curr_session.endOfGame && this.props.curr_session.currentSong > 1)
                ? "End of The Game" : "Guess the song"}</h1>
            {this.state.loading ? <div className="cssload-spin-box"/>:
              <div id="song-options-container">
                {this.state.options.map( ( e, i ) => {
                  return (
                    <button key={i} className={"song-option " + ((this.props.curr_session.endOfGame||this.state.disabled) ? "disabled " : " ")
                      + (this.state.disabled ?( e === this.state.actualTrack)? "song-item-ok" : "song-item-wrong": "")}
                    onClick={() => !this.props.curr_session.endOfGame && this.selectOption( e )}>
                      <h3>{e}</h3>
                    </button>
                  );
                } )}
              </div>
            }
          </div>
          <div className="leaderBoard">
            <h2 className="whiteAndCenter">Leaderboard</h2>
            {leader.map( ( user, i ) => {
              return (
                <div className="whiteAndCenter" key={user}>
                  {this.props.curr_session.endOfGame && i === 0
                    ? <h1><i className="fas fa-crown"/>{`${user}:${this.props.curr_session.users[ user ].score}`}</h1>
                    : <span>({`${user}:${this.props.curr_session.users[ user ].score}`})</span>
                  }
                </div>
              );
            } )}
          </div>
        </div>
      </div>
    );
  }
}

Spotitfy.propTypes = {
  session: PropTypes.object.isRequired,
  spotify_tokens: PropTypes.object.isRequired,
  fullPlaylist: PropTypes.object.isRequired,
  curr_session: PropTypes.object,
  changeState: PropTypes.func
};


export default withTracker( ( props ) => {
  Meteor.subscribe( "sessions" );

  return {
    curr_session: Sessions.findOne( { "id": props.session.id } ),
  };
} )( Spotitfy );
