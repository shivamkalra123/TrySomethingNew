import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Home = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (!username) return alert('Enter your name');
    const newRoom = uuidv4().slice(0, 6);
    navigate(`/room/${newRoom}`, { state: { username } });
  };

  const handleJoinRoom = () => {
    if (!username || !roomId) return alert('Enter name and room ID');
    navigate(`/room/${roomId}`, { state: { username } });
  };

  return (
    <div style={{ textAlign: 'center', marginTop: 100 }}>
      <h2>🎮 Welcome</h2>
      <input
        placeholder="Enter your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ padding: 10, margin: 5 }}
      />
      <br />
      <button onClick={handleCreateRoom} style={btn}>Create Room</button>
      <div style={{ margin: 15 }}>or</div>
      <input
        placeholder="Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{ padding: 10, margin: 5 }}
      />
      <br />
      <button onClick={handleJoinRoom} style={btn}>Join Room</button>
    </div>
  );
};

const btn = {
  padding: '10px 20px',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 16,
  cursor: 'pointer'
};

export default Home;
