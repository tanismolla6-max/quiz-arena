import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { randomInt, randomUUID } from 'crypto';

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map(s => s.trim()) }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'quiz-arena-server' }));
const io = new Server(server, { cors: { origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map(s => s.trim()), methods: ['GET', 'POST'] } });

const QUESTION_BANK = [
  { category: 'Science', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correct: 1 },
  { category: 'Geography', question: 'What is the capital city of Japan?', options: ['Kyoto', 'Osaka', 'Tokyo', 'Sapporo'], correct: 2 },
  { category: 'Technology', question: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Power Utility', 'Core Program Upload', 'Central Performance User'], correct: 0 },
  { category: 'Nature', question: 'What is the largest mammal on Earth?', options: ['African elephant', 'Giraffe', 'Whale shark', 'Blue whale'], correct: 3 },
  { category: 'Maths', question: 'What is 12 × 8?', options: ['84', '96', '108', '88'], correct: 1 },
  { category: 'History', question: 'The ancient Olympic Games began in which country?', options: ['Italy', 'Egypt', 'Greece', 'Turkey'], correct: 2 },
  { category: 'Space', question: 'Which star is closest to Earth?', options: ['Sirius', 'The Sun', 'Polaris', 'Proxima Centauri'], correct: 1 },
  { category: 'Literature', question: 'Who wrote Romeo and Juliet?', options: ['Charles Dickens', 'Jane Austen', 'William Shakespeare', 'George Orwell'], correct: 2 },
  { category: 'Science', question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 2 },
  { category: 'General knowledge', question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'], correct: 1 },
  { category: 'Geography', question: 'Which is the largest ocean?', options: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'], correct: 3 },
  { category: 'Technology', question: 'Which of these is a programming language?', options: ['Python', 'Falcon', 'Cheetah', 'Dolphin'], correct: 0 },
  { category: 'Science', question: 'What is the chemical symbol for gold?', options: ['Ag', 'Gd', 'Au', 'Go'], correct: 2 },
  { category: 'Sports', question: 'How many players from one team are on the field in a standard football (soccer) match?', options: ['9', '10', '11', '12'], correct: 2 },
  { category: 'General knowledge', question: 'Which language is primarily spoken in Brazil?', options: ['Spanish', 'Portuguese', 'French', 'Italian'], correct: 1 }
];
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const QUESTION_SECONDS = 15;
const MAX_QUESTIONS = 10;

function makeCode() {
  let code;
  do { code = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join(''); } while (rooms.has(code));
  return code;
}
function publicPlayers(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, answered: room.answers.has(p.id), isHost: p.id === room.hostId }));
}
function publicQuestion(room) {
  const q = room.questions[room.questionIndex];
  if (!q) return null;
  return { category: q.category, question: q.question, options: q.options, number: room.questionIndex + 1, total: room.questions.length, endsAt: room.endsAt, duration: QUESTION_SECONDS };
}
function emitState(room) {
  io.to(room.code).emit('room:update', {
    code: room.code, status: room.status, hostId: room.hostId,
    players: publicPlayers(room), question: room.status === 'question' ? publicQuestion(room) : null,
    questionIndex: room.questionIndex, totalQuestions: room.questions.length,
    reveal: room.status === 'reveal' ? { correctIndex: room.questions[room.questionIndex].correct, explanation: room.questions[room.questionIndex].explanation || '', answersCount: room.answers.size } : null
  });
}
function stopTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function startQuestion(room) {
  stopTimer(room);
  room.status = 'question'; room.answers = new Map(); room.endsAt = Date.now() + QUESTION_SECONDS * 1000;
  emitState(room);
  room.timer = setTimeout(() => revealQuestion(room.code), QUESTION_SECONDS * 1000);
}
function revealQuestion(code) {
  const room = rooms.get(code);
  if (!room || room.status !== 'question') return;
  stopTimer(room); room.status = 'reveal';
  const q = room.questions[room.questionIndex];
  for (const [playerId, answer] of room.answers.entries()) {
    const player = room.players.get(playerId);
    if (player && answer.choice === q.correct) {
      const remaining = Math.max(0, room.endsAt - answer.at);
      player.score += 500 + Math.round(500 * remaining / (QUESTION_SECONDS * 1000));
    }
  }
  emitState(room);
  room.timer = setTimeout(() => {
    if (!rooms.has(code)) return;
    if (room.questionIndex + 1 >= room.questions.length) {
      room.status = 'finished'; emitState(room); return;
    }
    room.questionIndex += 1; startQuestion(room);
  }, 3500);
}
function cleanName(value) { return String(value || '').trim().replace(/[<>\u0000-\u001F]/g, '').slice(0, 18); }
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code); socket.data.roomCode = null;
  if (!room) return;
  room.players.delete(socket.id); room.answers.delete(socket.id);
  if (room.players.size === 0) { stopTimer(room); rooms.delete(code); return; }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  emitState(room);
}
function shuffledQuestions() {
  return [...QUESTION_BANK].sort(() => Math.random() - 0.5).slice(0, MAX_QUESTIONS);
}
io.on('connection', socket => {
  socket.on('room:create', ({ name }, ack = () => {}) => {
    leaveRoom(socket);
    const playerName = cleanName(name);
    if (!playerName) return ack({ ok: false, error: 'Enter a nickname first.' });
    const code = makeCode();
    const room = { code, hostId: socket.id, players: new Map(), status: 'lobby', questions: shuffledQuestions(), questionIndex: 0, answers: new Map(), endsAt: null, timer: null };
    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0 });
    rooms.set(code, room); socket.join(code); socket.data.roomCode = code;
    ack({ ok: true, code, playerId: socket.id }); emitState(room);
  });
  socket.on('room:join', ({ code, name }, ack = () => {}) => {
    leaveRoom(socket);
    const roomCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(roomCode); const playerName = cleanName(name);
    if (!playerName) return ack({ ok: false, error: 'Enter a nickname first.' });
    if (!room) return ack({ ok: false, error: 'Room not found. Check the code and try again.' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'This quiz has already started.' });
    if (room.players.size >= 30) return ack({ ok: false, error: 'This room is full (30 players maximum).' });
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase())) return ack({ ok: false, error: 'That nickname is already taken in this room.' });
    room.players.set(socket.id, { id: socket.id, name: playerName, score: 0 }); socket.join(roomCode); socket.data.roomCode = roomCode;
    ack({ ok: true, code: roomCode, playerId: socket.id }); emitState(room);
  });
  socket.on('game:start', ack => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    if (room.hostId !== socket.id) return ack?.({ ok: false, error: 'Only the host can start the quiz.' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'The quiz has already started.' });
    if (room.players.size < 1) return ack?.({ ok: false, error: 'At least one player is required.' });
    room.questions = shuffledQuestions(); room.questionIndex = 0;
    for (const player of room.players.values()) player.score = 0;
    ack?.({ ok: true }); startQuestion(room);
  });
  socket.on('answer:submit', ({ choice }, ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.status !== 'question') return ack({ ok: false, error: 'No active question.' });
    if (!room.players.has(socket.id)) return ack({ ok: false, error: 'You are not in this room.' });
    if (room.answers.has(socket.id)) return ack({ ok: false, error: 'Your answer is already locked.' });
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return ack({ ok: false, error: 'Invalid answer.' });
    if (Date.now() >= room.endsAt) { revealQuestion(room.code); return ack({ ok: false, error: 'Time is up.' }); }
    room.answers.set(socket.id, { choice, at: Date.now() }); ack({ ok: true });
    emitState(room);
    if (room.answers.size === room.players.size) revealQuestion(room.code);
  });
  socket.on('game:play-again', ack => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    if (room.hostId !== socket.id) return ack?.({ ok: false, error: 'Only the host can start another game.' });
    stopTimer(room); room.status = 'lobby'; room.questionIndex = 0; room.answers.clear(); room.questions = shuffledQuestions(); room.endsAt = null;
    for (const player of room.players.values()) player.score = 0;
    ack?.({ ok: true }); emitState(room);
  });
  socket.on('disconnect', () => leaveRoom(socket));
});

const port = Number(process.env.PORT || 3001);
server.listen(port, '0.0.0.0', () => console.log(`Quiz Arena server listening on ${port}`));
