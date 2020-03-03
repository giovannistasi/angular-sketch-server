let express = require('express');
let app = express();
let cors = require('cors');

app.use(cors({origin:"https://xenodochial-keller-72c5e1.netlify.com/"}));
let http = require('http');
let server = http.Server(app);

let socketIO = require('socket.io');
let io = socketIO(server);
// io.set( 'origins', 'https://xenodochial-keller-72c5e1.netlify.com/' );
io.origins('*:*')

const port = process.env.PORT || 80;



server.listen(port, () => {
  console.log(`started on port: ${port}`);
});

const wordlist = require('./words');
let users = [];
let userIndex = -1;
let turnDuration = 65;
let endTurnDuration = 5;
let timeLeft = turnDuration;
let currentWord;
let nextWord;
let guessed = 0;

setInterval(() => {  
  timeLeft--;
  io.emit('time-left', timeLeft - endTurnDuration);
  if (timeLeft === endTurnDuration) {
    if (users.length > 1) {
      const nextPlayer = users[userIndex + 1] ? users[userIndex + 1].name : users[0].name;
      nextWord = wordlist[Math.floor(Math.random() * wordlist.length)];
      const data = {
        nextPlayer: nextPlayer,
        currentWord: currentWord,
        nextWord: nextWord
      }
      io.emit('turn-end', data);
    }
  }

  if (timeLeft === 0) {
    chooseArtist();
    timeLeft = turnDuration;
  }

}, 1000)

function chooseArtist() {
  if (users.length < 2) return;

  userIndex++;
  if (userIndex >= users.length)
    userIndex = 0;

  nextWord ? currentWord = nextWord : currentWord = wordlist[Math.floor(Math.random() * wordlist.length)];
  io.to(users[userIndex].id).emit('current-word', currentWord);
  users[userIndex].currentArtist = true;
  timeLeft = turnDuration;
}

io.sockets.on('connection',
  function (socket) {
    console.log('connected');
    

    socket.on('name', function (name) {
      const user = {
        name: name,
        score: 0,
        currentArtist: false,
        id: socket.id
      };
      console.log(name);
      
      users.push(user);

      socket.broadcast.emit("new-message", name + ' joined the game!');

      if (users.length === 1) {
        io.emit('waiting', true);
      }

      if (users.length === 2) {
        io.emit('waiting', false);
        chooseArtist();
      }

      io.emit('users', users);
    });

    socket.on('disconnect', function () {
      const user = users.find(user => user.id === socket.id);

      if(user) {
        let username = user.name;
        io.emit("new-message", username + ' has left the game!');
      }

      if (users[userIndex] && socket.id === users[userIndex].id) {
        timeLeft = endTurnDuration + 1;
      }

      users = users.filter(function (user) {
        return user.id !== socket.id;
      });

      if (!users.length) return;

      if (users.length === 1) {
        io.emit('waiting', true);
      }

      io.emit('users', users);
    });

    socket.on('mouse', function (data) {
      socket.broadcast.emit('mouse', data);
    });

    socket.on('clear', function () {
      io.emit('clear');
    });

    socket.on('guess', function (message) {
      const user = users.find(user => user.id === socket.id);
      if (message.toLowerCase() === currentWord) {
        user.score += (timeLeft-endTurnDuration) * 10;
        io.emit('users', users);
        io.to(socket.id).emit('disable-input');
        io.emit('new-message', user.name + ' guessed the word!');
        guessed++;
        if (guessed === users.length-1) timeLeft = endTurnDuration + 1;

      } else {
        message = user.name + ': ' + message;
        io.emit("new-message", message);
      }

    });

    socket.on('reset-turn', () => {
      timeLeft = turnDuration;
      if (users.length > 1) {
        const artist = users.find(user => user.currentArtist === true);
        artist.score += guessed * 100;
        guessed = 0;
      }

      users.forEach(user => user.currentArtist = false);
      users.find(user => user.id === socket.id).currentArtist = true;
      
      io.emit('users', users);
      io.emit('change-color', 'black');
      io.emit('time-left', timeLeft - endTurnDuration);
    });

    socket.on('change-color', color => {
      io.emit('change-color', color);
    })
  }
);