const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const Sequelize = require('sequelize')

const DB_USER = 'danyhan'
const DB_PASS = ''
const DB_HOST = 'localhost'
const DB_PORT = 5432
const DB_NAME = 'success_mysalonusa_dev'
const sequelize = new Sequelize(`postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
/*
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
*/
const States = sequelize.define('states', {
  name: Sequelize.STRING
}, {
  underscored: true
})
const Communities = sequelize.define('communities', {
  name: Sequelize.STRING
}, {
  underscored: true
})

const Chats = sequelize.define('chats', {
  message: Sequelize.STRING,
  nickname: Sequelize.STRING,
  email: Sequelize.STRING,
  state_id: {
    type: Sequelize.INTEGER,
    references: {
      model: States,
      key: 'id'
    }
  },
  community_id: {
    type: Sequelize.INTEGER,
    references: {
      model: Communities,
      key: 'id'
    }
  }
}, {
  underscored: true
});

Chats.hasOne(Communities, {
  foreignKey: 'id'
})
const cors = require("cors");

app.use(cors());

const setupStateRoom = ({
  id: stateId,
  name: stateName
}) => {
  const stateio = io.of('/' + stateId)
  stateio.on("connection", function (socket) {
    console.log("a user connected to " + stateName);

    States.findOne({
      where: {
        name: stateName
      }
    }).then(state => {

      socket.on("message", chatMessage => {
        chatMessage = JSON.parse(chatMessage)
        const {
          message,
          nickname
        } = chatMessage

        Communities.findOne({
          where: {
            name: chatMessage.community.name
          }
        }).then(community => {
          const values = {
            message,
            nickname,
            community_id: community.id,
            state_id: state.id
          }
          Chats.create(
            values, {
              include: Communities
            }
          ).then(message => {
            // TODO refactor - find a better way for eager loading
            message = JSON.stringify(message)
            message = JSON.parse(message)
            message.community = community
            message = JSON.stringify(message)

            socket.broadcast.emit("publish", message);
            socket.emit("publish", message);
          })
        })
      });
    })
  });
}

[{
  id: 'NY',
  name: 'New York'
}, {
  id: 'CA',
  name: 'California'
}, {
  id: 'IL',
  name: 'Illinois'
}].forEach(setupStateRoom);

http.listen(3000, function () {
  console.log("listening on *:3000");
});