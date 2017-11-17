var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
const {
  sequelize,
  Chats,
  States,
  Communities,
  findStateByAbbreviation
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
  app.get("/fetchChats", async function(req, res, next) {
    const { skip, limit, state, community } = req.query;

    try {
      const foundState = await findStateByAbbreviation(state);
      const foundCommunity = await Communities.findOne({
        where: { name: community.toLowerCase() }
      });
      if (!foundState || !foundCommunity) {
        res.json([]);
        return;
      }

      const chats = await Chats.findAll({
        offset: skip,
        limit,
        where: {
          state_id: foundState.id,
          community_id: foundCommunity.id
        },
        order: [["created_at", "DESC"]]
      });

      res.json(chats);
    } catch (err) {
      console.error(err);
    }
  });
};
