var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const multer = require("multer");
const sendMail = require("./sendMail");
const upload = multer({
  limits: { fieldSize: 25 * 1024 * 1024 }
});

const uploadFile = require("./uploadFile");

const {
  sequelize,
  Chats,
  States,
  Cities,
  Communities,
  BusinessOnSales,
  MessengerJobs,
  createChatMessage,
  publishChatMessage,
  findCityIdsInStateId,
  findState
} = require("./models");

module.exports = app => {
  // uncomment after placing your favicon in /public
  //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
  //  app.use(logger("dev"));
  app.set("view engine", false);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  /* GET home page. */
  app.get("/fetchChats", async function(req, res, next) {
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
      };

      if (beforeId) {
        where.id = {
          $lt: beforeId
        };
      }

      let chats = await Chats.findAll({
        limit,
        where,
        order: [["id", "DESC"]]
      });

      const promisedChats = chats.map(chat => {
        return new Promise(resolve => {
          chat = chat.toJSON();

          if (chat.chat_type == 1) {
            //job
            let job = JSON.parse(chat.message);
            MessengerJobs.findById(job.id).then(job => {
              chat.message = JSON.stringify(job);
              resolve(chat);
            });
          } else {
            resolve(chat);
          }
        });
      });

      Promise.all(promisedChats).then(chats => {
        res.json(chats);
      });

      //res.json(chats);
    } catch (err) {
      console.error(err);
    }
  });

  app.get("/fetchCities", async function(req, res) {
    const { state } = req.query;

    const foundState = await findState(state);

    if (!foundState) {
      return res.json([]);
    }
    const cities = await Cities.findAll({
      where: {
        state_id: foundState.id
      }
    });

    res.json(cities);
  });

  app.get("/fetchJobs", async function(req, res, next) {
    const { skip, limit, state, community } = req.query;

    try {
      const foundState = await findState(state);
      const foundCommunity = await Communities.findOne({
        where: { name: community.toLowerCase() }
      });

      if (!foundState) {
        res.json([]);
        return;
      }

      const where = {
        state_id: foundState.id
      };

      if (foundCommunity) {
        where.community_id = foundCommunity.id;
      }

      const query = {
        limit,
        offset: skip,
        where,
        order: [["created_at", "DESC"]]
      };
      const countQuery = Object.assign({}, query);
      delete countQuery.limit;
      delete countQuery.offset;

      const count = await MessengerJobs.count(countQuery);

      const jobs = await MessengerJobs.findAll(query);

      res.header("X-Total-Count", count);
      res.json(jobs);
    } catch (err) {
      console.error(err);
    }
  });

  app.get("/dashboardInfo", async function(req, res) {
    const aMonthAgo = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

    const { state } = req.query;

    const foundState = await findState(state);

    const businessOnSalesWhere = {
      created_at: {
        [Sequelize.Op.gt]: aMonthAgo
      }
    };
    if (foundState) {
      const cityIdsInState = await findCityIdsInStateId(foundState.id);

      businessOnSalesWhere.city_id = {
        in: cityIdsInState
      };
    }
    const businessOnSalesCount = await BusinessOnSales.count({
      where: businessOnSalesWhere
    });

    const jobsWhere = {
      created_at: {
        [Sequelize.Op.gt]: aMonthAgo
      }
    };
    if (foundState) {
      jobsWhere.state_id = foundState.id;
    }
    const jobsCount = await MessengerJobs.count({
      where: jobsWhere
    });

    const chatsWhere = {
      created_at: {
        [Sequelize.Op.gt]: aMonthAgo
      }
    };
    if (foundState) {
      chatsWhere.state_id = foundState.id;
    }
    const chatsCount = await Chats.count({
      where: chatsWhere
    });

    res.json({
      businessOnSalesCount,
      jobsCount,
      chatsCount
    });
  });

  app.get("/fetchBusinessOnSales", async function(req, res, next) {
    const { skip, limit, state } = req.query;

    try {
      const foundState = await findState(state);

      if (!foundState) {
        res.json([]);
        return;
      }

      const cityIdsInState = await findCityIdsInStateId(foundState.id);

      const where = {
        city_id: {
          in: cityIdsInState
        }
      };

      const query = {
        limit,
        offset: skip,
        where,
        order: [["created_at", "DESC"]],
        include: [{ model: Cities, required: true }]
      };

      const countQuery = Object.assign({}, query);
      delete countQuery.limit;
      delete countQuery.offset;

      const count = await BusinessOnSales.count(countQuery);

      const results = await BusinessOnSales.findAll(query);

      res.header("X-Total-Count", count);
      res.json(results);
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/createBusiness", upload.array(), async function(req, res, next) {
    const {
      community,
      email,
      description,
      title,
      price,
      images,
      fileNames,
      contentTypes,
      state,
      city: city_id,
      uniqueNickname
    } = req.body;

    try {
      const createdBusiness = await BusinessOnSales.create({
        description,
        title,
        views: 0,
        nickname: uniqueNickname,
        contact_email: email,
        price_string: price,
        city_id,
        image_urls: []
      });
      /*
      publishChatMessage({
        type: "job",
        nickname: uniqueNickname,
        message: JSON.stringify(createdJob),
        email,
        description,
        state: foundState.id,
        community: foundCommunity.name
      });*/

      res.json({ success: true, business: createdBusiness });

      const promises = images.map((image, index) => {
        const fileName = fileNames[index];
        const parts = fileName.split(".");
        const extension = parts[parts.length - 1];

        return uploadFile(image, {
          contentType: contentTypes[index],
          key: [
            "uploads",
            "business_on_sale",
            "images",
            createdBusiness.id,
            index + 1 + "." + extension
          ].join("/")
        });
      });

      Promise.all(promises).then(urls => {
        createdBusiness.update({
          image_urls: urls
        });
      });
    } catch (err) {
      console.error(err);
    }
  });

  app.post("/createJob", async function(req, res, next) {
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

  app.patch("/incrementJobView", async function(req, res) {
    const { id } = req.body;

    const job = await MessengerJobs.findById(id);

    const views = (job.views || 0) + 1;

    await job.update({ views });

    res.json({ success: true, views });
  });

  app.patch("/incrementBusinessView", async function(req, res) {
    const { id } = req.body;

    const business = await BusinessOnSales.findById(id);

    const views = (business.views || 0) + 1;

    await business.update({ views });

    res.json({ success: true, views });
  });

  app.post("/applyForJob", async function(req, res, next) {
    const { email, message, job } = req.body;

    const foundJob = await MessengerJobs.findById(job.id);
    console.log("Sending email to " + foundJob.email);
    sendMail({
      to: foundJob.email,
      subject: "Someone has applied to your MySalonUSA job",
      html: `You have a new application for the job "${
        foundJob.description
      }" on MySalonUSA. Find the details below:<br /><br />
<b>Email:</b> ${email}<br />
<b>Message:</b> ${message}.`
    });

    res.json({
      success: true
    });
  });
};
