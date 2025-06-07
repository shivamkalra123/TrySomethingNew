import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import './Room.css';

const socket = io('https://trysomethingnew.onrender.com:4000');

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const username = location.state?.username;

  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState('Joining room...');
  const [currentTurnIndex, setCurrentTurnIndex] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [currentLetter, setCurrentLetter] = useState(null);
  const [currentFlag, setCurrentFlag] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [countryList, setCountryList] = useState([]);

  const recognitionRef = useRef(null);
  const usernameRef = useRef(username);

  if (!username) return <Navigate to="/" />;

  const normalize = (str) => str.trim().toLowerCase().replace(/[^\w\s]/gi, '');

  const fetchCountryFlag = async (countryName) => {
    try {
      const res = await fetch(`https://restcountries.com/v3.1/name/${countryName}`);
      const data = await res.json();
      return data?.[0]?.flags?.png || null;
    } catch (err) {
      return null;
    }
  };

  const myPlayerIndex = players.findIndex((p) => p.username === usernameRef.current);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name');
        const data = await res.json();
        const names = data.map(c => c.name.common.toLowerCase().trim());
        setCountryList(names);
      } catch (err) {
        console.error('Failed to fetch country list', err);
      }
    };

    loadCountries();
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        }
      }
      setSpokenText(final.trim());
    };

    recognition.onerror = (event) => console.error('🎙️ STT Error:', event.error);

    return () => recognition.stop();
  }, []);

  useEffect(() => {
    if (
      !spokenText ||
      players.length === 0 ||
      myPlayerIndex === -1 ||
      currentTurnIndex !== myPlayerIndex
    ) return;

    const trySubmit = async () => {
      const name = spokenText.trim().toLowerCase();

      if (!countryList.includes(name)) {
        setStatus(`❌ "${spokenText}" is not a valid country`);
        return;
      } 
      
      socket.emit('countrySpoken', { roomId, country: name });
      setSpokenText('');
    };

    trySubmit();
  }, [spokenText, currentTurnIndex, myPlayerIndex, players, countryList]);

  useEffect(() => {
    socket.emit('joinRoom', { roomId, username });

    socket.on('roomJoined', () => setStatus(`✅ Joined room: ${roomId}`));

    socket.on('startGame', ({ players, currentTurnIndex }) => {
      setPlayers(players);
      setCurrentTurnIndex(currentTurnIndex);
      setGameHistory([]);
      setCurrentLetter(null);
      setStatus('🎮 Game started!');
    });

    socket.on('roomFull', () => setStatus('❌ Room is full'));

    socket.on('invalidCountry', ({ reason }) => {
      setStatus(`❌ ${reason}`);
    });

    socket.on('turnUpdate', async ({ currentTurnIndex, requiredLetter, lastCountry, history }) => {
      const flag = await fetchCountryFlag(lastCountry);
      setCurrentFlag(flag);
      setCurrentTurnIndex(currentTurnIndex);
      setCurrentLetter(requiredLetter);
      setGameHistory(history);
      setStatus(`✅ Your turn if it starts with "${requiredLetter}"`);
    });

    socket.on('userLeft', () => {
      setStatus('⚠️ Opponent left');
      setPlayers([]);
      setCurrentTurnIndex(null);
    });

    return () => {
      socket.off('roomJoined');
      socket.off('startGame');
      socket.off('roomFull');
      socket.off('invalidCountry');
      socket.off('turnUpdate');
      socket.off('userLeft');
    };
  }, [roomId, username]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && currentTurnIndex === myPlayerIndex && !micActive) {
        e.preventDefault();
        setMicActive(true);
        recognitionRef.current?.start();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && micActive) {
        e.preventDefault();
        setMicActive(false);
        recognitionRef.current?.stop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentTurnIndex, myPlayerIndex, micActive]);

  return (
    <div className="room-container">
      <h2>🌍 Room: {roomId}</h2>
      <p className="status">{status}</p>

      {currentLetter && (
        <p className="current-letter">
          Current Letter: <strong>{currentLetter}</strong>
        </p>
      )}

      {currentFlag ? (
        <div className="flag-container">
          <img src={currentFlag} alt="flag" className="flag" />
          <p className="last-country">{gameHistory.at(-1)}</p>
        </div>
      ) : (
        <div className="flag-placeholder">Flag will appear here</div>
      )}

      {gameHistory.length > 0 && (
        <div className="history-container">
          <h4>📝 History:</h4>
          <ol>
            {gameHistory.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>
      )}

      {players.length === 2 && (
        <div className="players-container">
          {players.map((p, i) => (
            <div
              key={p.id}
              className={`player-card ${i === currentTurnIndex ? 'active' : ''}`}
            >
              <strong>Player {i + 1}</strong>
              <br />
              {p.username}
              {i === currentTurnIndex && i === myPlayerIndex && (
                <div className={`mic-status ${micActive ? 'listening' : 'idle'}`}>
                  {micActive ? '🎤 Listening...' : '🔇 Press Space to Talk'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentTurnIndex === myPlayerIndex && (
        <div className="spoken-text-container">
          <strong>Spoken:</strong>
          <p>{spokenText || 'Hold space to speak...'}</p>
        </div>
      )}
    </div>
  );
};

export default Room;
