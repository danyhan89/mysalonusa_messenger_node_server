var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
const {
  sequelize,
  Chats,
  States,
  Communities,
  MessengerJobs,
  createChatMessage,
  publishChatMessage,
  findState
} = require("./models");

module.exports = app => {
  // uncomment after placing your favicon in /public
  //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
  //  app.use(logger("dev"));
  app.set("view engine", false);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());

  /* GET home page. */
  app.get("/fetchChats", async function (req, res, next) {
    const { beforeId, limit, state, community } = req.query;

    try {
      const foundState = await findState(state);
      const foundCommunity = await Communities.findOne({
        where: { name: community.toLowerCase() }
      });
      if (!foundState || !foundCommunity) {
        res.json([]);
        return;
      }

      const where = {
        state_id: foundState.id,
        community_id: foundCommunity.id
      }

      if (beforeId) {
        where.id = {
          $lt: beforeId
        }
      }

      const chats = await Chats.findAll({
        limit,
        where,
        order: [["id", "DESC"]]
      });

      res.json(chats);
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/createJob", async function (req, res, next) {
    const {
      community,
      email,
      description,
      state,
      nickname,
      uniqueNickname
    } = req.body;

    try {
      const foundState = await findState(state);
      const foundCommunity = await Communities.findOne({
        where: { name: community.toLowerCase() }
      });
      if (!foundState || !foundCommunity) {
        res.json({
          success: false,
          message: !foundState
            ? `No state "${state}" found!`
            : `No community "${community}" found!`
        });
        return;
      }

      const createdJob = await MessengerJobs.create({
        nickname,
        email,
        description,
        state_id: foundState.id,
        community_id: foundCommunity.id
      });

      publishChatMessage({
        type: "job",
        nickname: uniqueNickname,
        message: JSON.stringify(createdJob),
        email,
        description,
        state: foundState.id,
        community: foundCommunity.name
      });

      res.json({ success: true, job: createdJob });
    } catch (err) {
      console.error(err);
    }
  });


  app.post("/applyForJob", async function (req, res, next) {
    const {
    community,
      email,
      description,
      state,
      nickname,
      uniqueNickname
  } = req.body;

    res.json({
      success: true
    })
  })

};

