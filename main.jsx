import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { Zap, Users, Trophy, Copy, ArrowRight, Crown, Timer, CheckCircle2, XCircle, Sparkles, Wifi, Link2, RotateCcw, LogOut, CircleHelp } from 'lucide-react';
import './styles.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
const socket = io(SERVER_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
const LETTERS = ['A', 'B', 'C', 'D'];
function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState(new URLSearchParams(window.location.search).get('room') || '');
  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(socket.id || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [copied, setCopied] = useState(false);
  const lastQuestionKey = useRef('');

  useEffect(() => {
    const onConnect = () => { setConnected(true); setMyId(socket.id); };
    const onDisconnect = () => setConnected(false);
    const onUpdate = data => {
      setRoom(data);
      const questionKey = data.question ? `${data.code}:${data.question.number}:${data.question.endsAt}` : '';
      if (data.status === 'question' && questionKey && questionKey !== lastQuestionKey.current) {
        lastQuestionKey.current = questionKey; setSelected(null); setLocked(false);
      }
      if (data.status === 'reveal') setLocked(true);
      if (data.status === 'lobby') { lastQuestionKey.current = ''; setSelected(null); setLocked(false); }
    };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('room:update', onUpdate);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('room:update', onUpdate); };
  }, []);

  useEffect(() => {
    if (!room?.question?.endsAt || room.status !== 'question') return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((room.question.endsAt - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 100); return () => clearInterval(id);
  }, [room?.question?.endsAt, room?.status]);

  const me = room?.players?.find(p => p.id === myId);
  const sortedPlayers = useMemo(() => [...(room?.players || [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)), [room?.players]);
  const isHost = room?.hostId === myId;

  function runAction(eventName, payload, onSuccess) {
    setError(''); setNotice('');
    socket.emit(eventName, payload, result => {
      if (!result?.ok) setError(result?.error || 'Something went wrong. Please try again.');
      else onSuccess?.(result);
    });
  }
  function createRoom() {
    runAction('room:create', { name }, result => { setCode(result.code); setMyId(result.playerId); setScreen('room'); window.history.replaceState({}, '', `?room=${result.code}`); });
  }
  function joinRoom() {
    runAction('room:join', { name, code }, result => { setCode(result.code); setMyId(result.playerId); setScreen('room'); window.history.replaceState({}, '', `?room=${result.code}`); });
  }
  async function copyText(text, message = 'Copied!') {
    try { await navigator.clipboard.writeText(text); setNotice(message); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setNotice(`Copy this: ${text}`); }
  }
  function startGame() { runAction('game:start', {}, () => setNotice('Quiz starting…')); }
  function submitAnswer(index) {
    if (locked || selected !== null || room?.status !== 'question') return;
    setSelected(index);
    runAction('answer:submit', { choice: index }, result => setLocked(true));
  }
  function playAgain() { runAction('game:play-again', {}, () => setNotice('New round ready!')); }
  function leave() { socket.disconnect(); socket.connect(); setRoom(null); setScreen('home'); setError(''); setNotice(''); setSelected(null); setLocked(false); window.history.replaceState({}, '', window.location.pathname); }
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${room?.code || code}`;

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => screen === 'home' ? null : leave()} aria-label="Quiz Arena home"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><span>quiz<span className="brand-light">arena</span></span></button>
      <div className="top-right"><span className={`connection ${connected ? 'online' : ''}`}><span className="status-dot" />{connected ? 'Connected' : 'Reconnecting'}</span>{room && <button className="icon-button" onClick={leave} title="Leave room"><LogOut size={17}/></button>}</div>
    </header>

    {screen === 'home' || !room ? <main className="home-layout">
      <section className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR FRIEND GROUP, BUT COMPETITIVE</div><h1>Big brains.<br/><span>Fast fingers.</span><br/>One winner.</h1><p className="hero-sub">The live quiz game for your group chat. Create a room, invite your friends, and see who really knows it all.</p>
        <div className="feature-row"><div><span className="feature-icon purple"><Users size={18}/></span><span><b>Up to 30 players</b><small>One room, all your friends</small></span></div><div><span className="feature-icon yellow"><Trophy size={18}/></span><span><b>Live leaderboard</b><small>Every point counts</small></span></div></div>
        <div className="hero-foot"><span><Wifi size={14}/> Real-time multiplayer</span><span><Timer size={14}/> 15-second rounds</span></div>
      </section>
      <section className="join-card"><div className="card-orb orb-one"/><div className="card-orb orb-two"/><div className="card-heading"><span className="mini-icon"><Zap size={18} fill="currentColor"/></span><div><h2>Ready to play?</h2><p>Jump in or host your own quiz.</p></div></div>
        <label htmlFor="nickname">YOUR NICKNAME</label><input id="nickname" maxLength={18} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. QuizMaster99" onKeyDown={e => e.key === 'Enter' && createRoom()} />
        <button className="primary-button" onClick={createRoom} disabled={!name.trim() || !connected}>Create a room <ArrowRight size={18}/></button>
        <div className="or-divider"><span/> OR JOIN A ROOM <span/></div>
        <label htmlFor="room-code">ROOM CODE</label><input id="room-code" className="code-input" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ENTER 6-CHAR CODE" onKeyDown={e => e.key === 'Enter' && joinRoom()} />
        <button className="secondary-button" onClick={joinRoom} disabled={!name.trim() || code.trim().length !== 6 || !connected}>Join friends <ArrowRight size={17}/></button>
        {error && <div className="alert error-alert">{error}</div>}
        <p className="card-note"><Link2 size={13}/> Got an invite link? Open it and enter your nickname.</p>
      </section>
    </main> : <main className="game-layout">
      <div className="game-main">
        <div className="room-strip"><div><span className="live-pip"/> ROOM <b>{room.code}</b><button className="tiny-copy" onClick={() => copyText(room.code, 'Room code copied!')} aria-label="Copy room code"><Copy size={13}/></button></div><button className="share-button" onClick={() => copyText(inviteUrl, 'Invite link copied!')}><Link2 size={15}/> Invite friends</button></div>
        {error && <div className="alert error-alert">{error}</div>}{notice && <div className="alert notice-alert">{notice}</div>}
        {room.status === 'lobby' && <section className="stage lobby-stage"><div className="stage-icon"><Users size={26}/></div><div className="eyebrow">THE ROOM IS OPEN</div><h1>Waiting for the squad<span>.</span></h1><p className="stage-sub">Share the code or invite link. The host starts when everyone's in.</p><div className="big-code" onClick={() => copyText(room.code, 'Room code copied!')}><span>{room.code}</span><Copy size={17}/></div><button className="text-link" onClick={() => copyText(inviteUrl, 'Invite link copied!')}><Link2 size={15}/> Copy invite link</button>
          <div className="lobby-players"><div className="section-line"><span>PLAYERS IN ROOM</span><b>{room.players.length}<small> / 30</small></b></div><div className="player-grid">{room.players.map((p, i) => <div className="player-chip" key={p.id}><span className={`avatar avatar-${i % 5}`}>{p.name.slice(0,1).toUpperCase()}</span><span>{p.name}{p.id === room.hostId && <Crown className="crown" size={13}/>}</span>{p.id === myId && <small>YOU</small>}</div>)}</div></div>
          {isHost ? <button className="primary-button start-button" onClick={startGame}><Zap size={17} fill="currentColor"/> Start the quiz <ArrowRight size={18}/></button> : <div className="waiting-pill"><span className="pulse-dot"/> Waiting for the host to start…</div>}
          <p className="stage-foot"><CircleHelp size={14}/> 10 random questions · 15 seconds each · Up to 30 players</p>
        </section>}

        {room.status === 'question' && room.question && <section className="stage question-stage"><div className="question-meta"><span className="question-count">QUESTION <b>{String(room.question.number).padStart(2,'0')}</b><small> / {String(room.question.total).padStart(2,'0')}</small></span><span className="category-pill">{room.question.category}</span></div><div className={`timer-wrap ${timeLeft <= 5 ? 'timer-danger' : ''}`}><svg viewBox="0 0 48 48" className="timer-ring"><circle cx="24" cy="24" r="20"/><circle className="timer-progress" cx="24" cy="24" r="20" style={{ strokeDashoffset: 125.66 * (1 - timeLeft / 15) }}/></svg><span>{timeLeft}</span></div><div className="question-progress"><span style={{width: `${(room.question.number / room.question.total) * 100}%`}}/></div><h1 className="question-title">{room.question.question}</h1><p className="answer-instruction">{locked || selected !== null ? 'Answer locked in — good luck!' : 'Choose your answer before time runs out.'}</p><div className="answers-grid">{room.question.options.map((option, i) => <button key={option} disabled={locked || selected !== null || timeLeft === 0} className={`answer-option option-${i} ${selected === i ? 'answer-selected' : ''}`} onClick={() => submitAnswer(i)}><span className="answer-letter">{LETTERS[i]}</span><span>{option}</span>{selected === i && <CheckCircle2 size={18} className="answer-check"/>}</button>)}</div><div className="question-bottom"><span><Users size={15}/> {room.players.length} playing</span><span><CheckCircle2 size={15}/> {room.players.filter(p => p.answered).length} / {room.players.length} answered</span></div></section>}

        {room.status === 'reveal' && room.question && <section className="stage reveal-stage"><div className="reveal-icon"><CheckCircle2 size={28}/></div><div className="eyebrow">ANSWER REVEALED</div><h1>Here's the answer<span>.</span></h1><p className="stage-sub reveal-question">{room.question.question}</p><div className="reveal-options">{room.question.options.map((opt, i) => <div key={opt} className={`reveal-option ${i === room.reveal?.correctIndex ? 'correct-option' : ''}`}><span className="answer-letter">{LETTERS[i]}</span><span>{opt}</span>{i === room.reveal?.correctIndex && <CheckCircle2 size={18}/>}</div>)}</div><div className="score-update"><Trophy size={17}/><span>Scores updated</span><small>Next question coming up…</small></div><Leaderboard players={sortedPlayers} myId={myId} compact /></section>}

        {room.status === 'finished' && <section className="stage finished-stage"><div className="winner-icon"><Trophy size={30}/></div><div className="eyebrow">QUIZ COMPLETE</div><h1>That's a wrap<span>.</span></h1><p className="stage-sub">The final scores are in. Respect the champion.</p><div className="podium">{sortedPlayers.slice(0,3).map((p, i) => <div className={`podium-person podium-${i+1}`} key={p.id}><div className="podium-crown">{i === 0 ? <Crown size={20}/> : <span>{i + 1}</span>}</div><div className={`podium-avatar avatar-${i}`}>{p.name.slice(0,1).toUpperCase()}</div><b>{p.name}{p.id === myId ? ' (you)' : ''}</b><strong>{p.score.toLocaleString()}</strong><div className="podium-block">{i === 0 ? '1ST' : i === 1 ? '2ND' : '3RD'}</div></div>)}</div><Leaderboard players={sortedPlayers} myId={myId} /><div className="finish-actions">{isHost && <button className="primary-button" onClick={playAgain}><RotateCcw size={17}/> Play again</button>}<button className="secondary-button" onClick={leave}>Back to home</button></div></section>}
      </div>
      <aside className="sidebar"><div className="sidebar-card"><div className="sidebar-title"><span><Trophy size={17}/></span><div><h3>Live leaderboard</h3><p>{room.status === 'lobby' ? 'Ready to compete' : room.status === 'finished' ? 'Final rankings' : 'Every point counts'}</p></div></div><Leaderboard players={sortedPlayers} myId={myId} /><div className="sidebar-foot"><span className="live-pip"/> Updates in real time</div></div><div className="sidebar-card players-card"><div className="sidebar-title"><span><Users size={17}/></span><div><h3>Players</h3><p>{room.players.length} in this room</p></div></div><div className="sidebar-player-list">{room.players.map((p, i) => <div className="sidebar-player" key={p.id}><span className={`avatar avatar-${i % 5}`}>{p.name.slice(0,1).toUpperCase()}</span><span className="sidebar-player-name">{p.name}{p.id === myId && <small>YOU</small>}</span>{p.id === room.hostId && <Crown size={14} className="crown"/>}</div>)}</div></div><div className="tip-card"><Sparkles size={17}/><p><b>Quick tip</b><br/>Correct answers earn up to 1,000 points. The faster you answer, the more you score.</p></div></aside>
    </main>}
    <footer className="footer"><span>© 2026 Quiz Arena</span><span>Made for friendly competition <span className="heart">♥</span></span></footer>
  </div>;
}
function Leaderboard({ players, myId, compact = false }) {
  if (!players?.length) return <div className="empty-leaderboard">Players will appear here.</div>;
  return <div className={`leaderboard ${compact ? 'leaderboard-compact' : ''}`}>{players.map((p, i) => <div className={`leader-row ${p.id === myId ? 'leader-me' : ''}`} key={p.id}><span className={`rank ${i < 3 ? `rank-${i+1}` : ''}`}>{i === 0 ? <Crown size={14}/> : String(i+1).padStart(2,'0')}</span><span className={`avatar avatar-${i % 5}`}>{p.name.slice(0,1).toUpperCase()}</span><span className="leader-name">{p.name}{p.id === myId && <small>YOU</small>}{p.isHost && <Crown size={12} className="crown leader-crown"/>}</span><strong className="leader-score">{p.score.toLocaleString()}<small> pts</small></strong></div>)}</div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
