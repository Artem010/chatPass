if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')

const server = require('http').Server(app)
const io = require('socket.io')(server);

const mysql = require('mysql2');
const connection = mysql.createPool({
  host: "remotemysql.com",
  user: "hmnwklXmKo",
  password: "C5DYSNcZIL",
  database: "hmnwklXmKo"
});

const initializePassport = require('./passport-config')
initializePassport(
  passport,
  login => users.find(user => user.login === login),
  id => users.find(user => user.id === id)
)

const users = []

app.set('view-engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

app.get('/main.css', (req, res) => {
  res.sendFile(__dirname + '/main.css')
})

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs', { name: req.user.name, color: req.user.color })
  // console.log(users);
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  findUserDB()
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)

    function random (){return Math.floor(Math.random() * (255- 0) + 0)}
    color = 'rgba('+random()+', '+random()+', '+random()+', 0.5)'
    // console.log(color);
    let sqlSELECT = "SELECT * FROM users WHERE login=? ";
    connection.query(sqlSELECT, req.body.login, (err, result) => {
      if(result == ''){
        regUserDB(req.body.login, req.body.name, hashedPassword, color);
        // console.log('Ok');
      }else console.log('error reg');
    })
    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.get('/logout', (req, res) => {
  req.logOut()
  res.redirect('/login')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

server.listen(3000)


io.on('connection', socket => {
  console.log("New coonect")

  socket.on('disconnect', () =>{
    console.log('user disconnected')
  })

  socket.on('newMessege', data =>{
    addMsgDB(data.name, data.msg)
    io.sockets.emit('Addmessage', {color:data.color, name:data.name, msg:data.msg})
  })

  socket.on('pushFiveMsgs', data =>{
    let m = [];
    let sqlSELECT = "SELECT * FROM messeges ORDER BY id DESC LIMIT 15";
    connection.query(sqlSELECT, function (err, result) {
      if (err) return console.log('ОШИБККА: ',err);

      for (let i = 0; i < result.length; i++) {
        m.unshift({
          msg: result[i].messege,
          name: result[i].name,
          color: result[i].color
        })
      }

      // console.log( m);
      socket.emit('PFM',  m);
    });

  });

})

function regUserDB(login, name, password, color) {

  let sqlINSERT = "INSERT INTO users(login, name, password, color) VALUES (?, ?, ?, ?)";
  connection.query(sqlINSERT, [login, name, password, color], function (err, result) {
    if (err) return console.log('ОШИБККА: ',err);
    console.log("User registered");
  });

}

function addMsgDB(name, msg) {
  var id ='F';
  var color ='';
  let sqlSELECT = "SELECT * FROM users WHERE name=?";
  connection.query(sqlSELECT, name, function (err, result) {
    if (err) return console.log('ОШИБККА: ',err);

    id = result[0].id;
    color = result[0].color;

    let sqlINSERT = "INSERT INTO messeges(id_name,name,messege,color) VALUES(?,?,?,?)";
    connection.query(sqlINSERT, [id,name,msg,color], function (err, result) {
      if (err) return console.log('ОШИБККА: ',err);
      console.log("Added msg");
    });
  });


}

function findUserDB() {
  let sqlSELECT = "SELECT * FROM users";
  connection.query(sqlSELECT, (err, result) => {

    result.forEach(item => {
      // console.log(ite);
      users.push({
        id: item.id,
        login: item.login,
        name: item.name,
        password:item.password,
        color: item.color
      })
    });

    console.log(users);

  })
}
