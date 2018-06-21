var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const multer = require("multer");
const passport = require("passport");
const sendMail = require("./sendMail");
const { deleteKeys, getObject, listContents } = require("./s3Utils");
const upload = multer({
  limits: { fieldSize: 25 * 1024 * 1024 }
});

const uploadFile = require("./uploadFile");

const encode = data => {
  const str = data.reduce(function(a, b) {
    return a + String.fromCharCode(b);
  }, "");
  return btoa(str).replace(/.{76}(?=.)/g, "$&\n");
};

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/admin/login");
};

const ensureAdmin = (req, res, next) => {
  console.log("user:", req.user, "!!!??");
  if (req.isAuthenticated() && req.user && req.user.admin) {
    return next();
  }
  res.redirect("/admin/login");
};

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

  app.delete("/jobs/:id", ensureAdmin, async function(req, res) {
    const { id } = req.params;
    await MessengerJobs.destroy({ where: { id } });
    res.json({
      success: true
    });
  });
  app.post("/jobs/:id", ensureAdmin, async function(req, res) {
    const { id } = req.params;
    const body = req.body;

    const job = await MessengerJobs.findById(id);
    const foundState = await findState(body.state);
    const foundCommunity = await Communities.findOne({
      where: { name: body.community.toLowerCase() }
    });

    console.log(body);

    await job.update({
      state_id: foundState.id,
      community_id: foundCommunity.id,
      nickname: body.nickname,
      email: body.email,
      views: body.views,
      description: body.description
    });
    res.json({
      success: true
    });
  });
  app.get("/test-admin", ensureAdmin, async function(req, res) {
    res.json({
      ok: true
    });
  });
  app.get("/test-login", ensureAuth, async function(req, res) {
    res.json({
      ok: true
    });
  });

  app.get("/test", async function(req, res) {
    res.json({
      ok: true
    });
  });

  app.get("/fetchJobs", async function(req, res, next) {
    const { skip, limit, state, community, filter } = req.query;

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
      const filterIds = filter ? filter.split(",") : null;

      if (filterIds) {
        where.id = {
          [Sequelize.Op.or]: filterIds
        };
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
    const { skip, limit, state, filter } = req.query;

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

      const filterIds = filter ? filter.split(",") : null;

      if (filterIds) {
        where.id = {
          [Sequelize.Op.or]: filterIds
        };
      }

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

  app.post("/editBusiness", ensureAuth, upload.array(), async function(
    req,
    res,
    next
  ) {
    const log = require("debug")("editBusiness");
    const {
      id,
      community,
      email,
      description,
      title,
      views,
      price,
      images,
      fileNames,

      contentTypes,
      state,
      city: city_id,
      uniqueNickname
    } = req.body;

    let { image_urls } = req.body;
    try {
      image_urls = image_urls.filter(u => u);

      log("image_urls", image_urls);
      const keepImagesMap = image_urls.reduce((acc, url) => {
        url = url.substring(url.indexOf("uploads/business_on_sale"));
        acc[url] = true;
        return acc;
      }, {});
      log("keepImagesMap", keepImagesMap);

      const key = ["uploads", "business_on_sale", "images", id].join("/");

      const contents = await listContents(key);

      let keepImages = await Promise.all(
        contents.map(async ({ Key }) => {
          return getObject({ Key })
            .then(response => {
              const { Body, ContentType } = response;
              const parts = Key.split("/");

              return {
                Body,
                Key,
                ContentType
              };
            })
            .catch(ex => {
              return {};
            });
        })
      );

      log("Current s3 images: ", keepImages);
      keepImages = keepImages.filter(item => {
        const { Key } = item;
        return Key && keepImagesMap[Key];
      });

      const keys = contents.map(({ Key }) => {
        return Key;
      });

      log(
        `Deleting keys: ${keys}, but keeping images: `,
        Object.keys(keepImages)
      );

      await deleteKeys(keys);

      const business = await BusinessOnSales.findById(id);
      await business.update({
        description,
        title,
        views,
        nickname: uniqueNickname,
        contact_email: email,
        price_string: price,
        city_id
      });

      log("Update business success.");
      res.json({ success: true, business });

      let imageIndex = 0;

      // upload prev images first
      const keepImagesPromises = keepImages.map(image => {
        const { Key, ContentType, Body } = image;

        const parts = Key.split(".");
        const extension = parts[parts.length - 1];
        imageIndex++;
        const key = [
          "uploads",
          "business_on_sale",
          "images",
          business.id,
          imageIndex + "." + extension
        ].join("/");
        log("Uploading old image - ", key);
        return uploadFile(Body, {
          contentType: ContentType,
          key
        });
      });

      // and then the newly uploaded images
      const promises = (images || []).map((image, index) => {
        const fileName = fileNames[index];
        const parts = fileName.split(".");
        const extension = parts[parts.length - 1];

        imageIndex++;
        const key = [
          "uploads",
          "business_on_sale",
          "images",
          business.id,
          imageIndex + "." + extension
        ].join("/");
        log("Uploading new image  - ", key);
        return uploadFile(image, {
          contentType: contentTypes[index],
          key
        });
      });

      Promise.all(keepImagesPromises.concat(promises)).then(urls => {
        log("Done uploading images");
        urls = urls || [];

        business.update({
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

  // authentication

  // GET /auth/google
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  The first step in Google authentication will involve
  //   redirecting the user to google.com.  After authorization, Google
  //   will redirect the user back to this application at /auth/google/callback
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: [
        "https://www.googleapis.com/auth/plus.login",
        "https://www.googleapis.com/auth/userinfo.email"
      ]
    })
  );
  /*
  create_table "users", force: :cascade do |t|
    t.string   "provider",                              null: false
    t.string   "uid",                                   null: false
    t.string   "name"
    t.string   "email"
    t.string   "location"
    t.string   "image_url"
    t.string   "prof_url"
    t.datetime "created_at",                            null: false
    t.datetime "updated_at",                            null: false
    t.boolean  "private_tokens_access", default: false
    t.integer  "private_tokens_left",   default: 0
    t.integer  "status",                default: 1
    t.boolean  "admin",                 default: false
  end
*/
  // GET /auth/google/callback
  //   Use passport.authenticate() as route middleware to authenticate the
  //   request.  If authentication fails, the user will be redirected back to the
  //   login page.  Otherwise, the primary route function function will be called,
  //   which, in this example, will redirect the user to the home page.
  app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/admin/login" }),
    function(req, res) {
      /*Users.findBy({
        email: req.u
      });*/
      res.redirect("/admin");
    }
  );

  const querystring = require("querystring");

  const getUserInfo = user => {
    return user
      ? {
          email: user.email,
          admin: user.admin
        } /*{
          id: user.id,
          displayName: user.displayName,
          name: user.name,
          photos: user.photos,
          email: user.emails && user.emails.length ? user.emails[0].value : null
      }*/
      : null;
  };

  app.get("/admin", ensureAuth, (req, res) => {
    const user = getUserInfo(req.user);
    res.redirect(
      process.env.FRONTEND_URL +
        "/admin/auth?user=" +
        querystring.escape(JSON.stringify(user))
    );
  });

  app.get("/admin/login", (req, res) => {
    res.redirect(process.env.FRONTEND_URL + "/admin/auth?user=");
  });
};
