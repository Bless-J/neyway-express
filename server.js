import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
app.use(express.json({ limit: '20kb' }));
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(root, { index: 'index.html' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code() { let value=''; for (let i=0;i<5;i++) value += alphabet[Math.floor(Math.random()*alphabet.length)]; return value; }
function gameDeck(level) {
  let seed = randomBytes(4).readUInt32BE(0) || 1;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const n=8+level*2, kinds=['📚','🪴','🍪','☕','🧸','🧦','💌','🕯️'];
  return Array.from({length:n},(_,i)=>({id:i+1,dest:Math.floor(rand()*3),kind:{name:'parcel',icon:kinds[Math.floor(rand()*kinds.length)]},fragile:i>=3&&rand()<(.12+level*.022),express:i>=2&&rand()<(.15+level*.025),window:6+Math.max(0,4-Math.floor(level/3))}));
}
function safeRoom(room) { return {code:room.code,level:room.level,status:room.status,deck:room.deck,deadline:room.deadline,players:room.players.map(p=>({name:p.name,score:p.score,done:p.done,finished:p.finished,connected:!!p.socket&&p.socket.readyState===WebSocket.OPEN}))}; }
function send(ws,data) { if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcast(room,type='state') { const state=safeRoom(room); for(const p of room.players) send(p.socket,{type,room:state}); }
function finishIfReady(room) {
  if(room.status!=='playing') return;
  if(room.players.every(p=>p.finished) || Date.now()>=room.deadline) {
    room.status='finished';
    const [a,b]=room.players, winner=a.score===b.score?'tie':a.score>b.score?0:1;
    broadcast(room,'finished');
  }
}
app.post('/api/rooms', (req,res)=>{
  const level=Math.max(1,Math.min(10,Number(req.body?.level)||1));
  let id; do{id=code()}while(rooms.has(id));
  const token=randomBytes(18).toString('hex');
  const room={code:id,level,status:'waiting',deck:gameDeck(level),deadline:0,players:[{name:'Player 1',token,score:0,done:0,finished:false,socket:null}]};
  rooms.set(id,room); res.json({code:id,token,player:0,room:safeRoom(room)});
});
app.post('/api/rooms/:code/join',(req,res)=>{
  const room=rooms.get(req.params.code.toUpperCase());
  if(!room) return res.status(404).json({error:'That room code was not found. Check it and try again.'});
  if(room.status!=='waiting'||room.players.length>=2) return res.status(409).json({error:'This room is already full or the game has started.'});
  const token=randomBytes(18).toString('hex'); room.players.push({name:'Player 2',token,score:0,done:0,finished:false,socket:null});
  res.json({code:room.code,token,player:1,room:safeRoom(room)}); broadcast(room);
});
app.post('/api/rooms/:code/start',(req,res)=>{
  const room=rooms.get(req.params.code.toUpperCase());
  if(!room||room.players[0].token!==req.body?.token) return res.status(403).json({error:'Only the host can start this room.'});
  if(room.players.length!==2||room.players.some(p=>!p.socket||p.socket.readyState!==WebSocket.OPEN)) return res.status(409).json({error:'Wait until your friend has joined and connected.'});
  if(room.status!=='waiting') return res.status(409).json({error:'This match has already started.'});
  room.status='playing'; room.deadline=Date.now()+Math.max(35,65-room.level*3)*1000;
  broadcast(room,'start'); res.json({ok:true,room:safeRoom(room)});
});
const server=createServer(app), wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost'), room=rooms.get((url.searchParams.get('room')||'').toUpperCase()), token=url.searchParams.get('token');
  const player=room?.players.find(p=>p.token===token);
  if(!player){socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{ws.room=room;ws.player=player;player.socket=ws;wss.emit('connection',ws,req);broadcast(room);});
});
wss.on('connection',(ws)=>{
  const {room,player}=ws; send(ws,{type:'state',room:safeRoom(room)});
  ws.on('message',raw=>{
    let msg; try{msg=JSON.parse(raw.toString())}catch{return;}
    if(msg.type==='progress'&&room.status==='playing'){
      player.done=Math.max(player.done,Math.min(room.deck.length,Number(msg.done)||0));
      player.score=Math.max(0,Math.min(999999,Number(msg.score)||0));
      if(msg.finished) player.finished=true;
      finishIfReady(room); broadcast(room);
    }
  });
  ws.on('close',()=>{if(player.socket===ws)player.socket=null;broadcast(room);});
});
setInterval(()=>{for(const room of rooms.values())finishIfReady(room)},1000).unref();
const port=Number(process.env.PORT)||3000; server.listen(port,'0.0.0.0',()=>console.log(`Neyway Express listening on ${port}`));
