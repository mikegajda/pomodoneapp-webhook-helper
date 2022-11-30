const {promisify} = require('util');
const stringHash = require("string-hash");
let ogs = require('open-graph-scraper');
const potrace = require('potrace');
const SVGO = require('svgo');
const AWS = require('aws-sdk');
ogs = promisify(ogs).bind(ogs);
let Jimp = require('jimp');
const url = require('url');
const fetch = require('node-fetch');

let awsKeyId = process.env.MG_AWS_KEY_ID;
let awsSecretAccessKey = process.env.MG_AWS_SECRET_ACCESS_KEY;
let shotstackApiKey = process.env.SHOTSTACK_API_KEY;

const s3 = new AWS.S3({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey
});

let polly = new AWS.Polly({
  accessKeyId: awsKeyId,
  secretAccessKey: awsSecretAccessKey,
  region: 'us-east-1'
})

svgo = new SVGO({
  multipass: true,
  floatPrecision: 0,
  plugins: [
    {
      removeViewBox: false,
    },
    {
      addAttributesToSVGElement: {
        attributes: [
          {
            preserveAspectRatio: `none`,
          },
        ],
      },
    },
  ],
});

async function uploadBufferToAmazon(buffer, filename) {
  // Setting up S3 upload parameters
  const params = {
    Bucket: "cdn.mikegajda.com",
    Key: filename, // File name you want to save as in S3
    Body: buffer,
    ACL: "public-read"
  };

  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.upload(params, function (err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  })
}

async function createSvg(buffer, params) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, params, function (err, svg) {
      if (err) {
        reject();
      } else {
        svgo.optimize(svg).then(function (optimizedSvg) {
          resolve(optimizedSvg.data);
        })
      }
    });
  });

}

async function checkIfFileExistsInS3(filename) {
  const params = {
    Bucket: "cdn.mikegajda.com",
    Key: filename, // File name you want to save as in S3
  };
  return new Promise((resolve, reject) => {
    // Uploading files to the bucket
    s3.headObject(params, function (err, data) {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    });
  })
}
function getDeverReactionText(reaction){
  let reactionText = ""
  switch (reaction) {
    case "angry":
      reactionText = "I'm so angry about this. Do you feel the same way? Tag someone who would also feel angry."
      break
    case "bored":
      reactionText = "I'm bored by this one. Do you feel the same way? Comment to tell me what you think."
      break
    case "claps":
      reactionText = "Claps! How do you feel about this one? Tag a friend that would clap along with you."
      break
    case "curse":
      reactionText = "I want to curse out loud about this one. What words come to mind for you when you see this headline?"
      break
    case "dislike":
      reactionText = "I do not like this at all. Care to tell me your thoughts on this one?"
      break
    case "happy_smile":
      reactionText = "I'm happy about this one! Are you also happy? Make someone's day by tagging them below!"
      break
    case "happy_stars":
      reactionText = "I really like this! Do you agree? Tell me your thoughts by commenting or tagging a friend."
      break
    case "laugh_crying":
      reactionText = "I laughed about this one. What was your reaction when you read this?"
      break
    case "like":
      reactionText = "I like this a lot! Do you agree? Tell me your thoughts and tag a friend that you think would agree."
      break
    case "love":
      reactionText = "I love this one. Tag someone who would also love this it and comment why you're tagging them!"
      break
    case "mind_blown":
      reactionText = "I'm mind blown! Agree? Disagree? Tell me what you think, or tag someone you think would be mind blown."
      break
    case "sad":
      reactionText = "I'm really saddened by this. Are you as well? Tell me why you're sad about this."
      break
    case "surprised":
      reactionText = "I'm surprised by this one. How do you feel? Tag a friend who you think should read this."
      break
    default:
      reactionText = "I'm not sure what I think about this one. What do you think? Tell me and we can have a discussion."
  }
  return reactionText;
}
async function getFileInS3(filename) {
  const params = {
    Bucket: "cdn.mikegajda.com",
    Key: filename
  };
  return new Promise((resolve, reject) => {
    s3.getObject(params, function (err, data) {
      if (err) {
        reject(err)
      }

      resolve(data.Body.toString());
    });
  })

}

async function getOpenGraphInfo(url) {
  return new Promise((resolve, reject) => {
    ogs({
      url: url
    }, function (error, results) {
      resolve(results)
    });
  })
}

async function getPollySpeechBufferForText(text, voiceId = 'Joanna', shouldUseNewsCaster = true) {
  return new Promise((resolve, reject) => {
    var params = {
      Engine: "neural",
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      Text: shouldUseNewsCaster ? `<speak><amazon:domain name="news">${text}</amazon:domain></speak>`: `<speak><prosody rate="130%">${text}</prosody></speak>`,
      TextType: "ssml",
      VoiceId: voiceId
    };

    polly.synthesizeSpeech(params, function (err, data) {
      if (err) {
        console.log(err, err.stack);
      }// an error occurred
      else {
        resolve(data.AudioStream);
      }           // successful response
      /*
      data = {
       AudioStream: <Binary String>,
       ContentType: "audio/mpeg",
       RequestCharacters: 37
      }
      */
    });
  })}

async function postToShotStack(body) {
  // complex POST request with JSON, headers:
  return new Promise((resolve, reject) => {
    fetch('https://api.shotstack.io/stage/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${shotstackApiKey}`
      },
      body: JSON.stringify(body)
    }).then(r => {
      resolve(r.json());
    })
    .catch((error) => {
      reject(error)
    })
  })
}

async function getShotStackResult(id) {
  // complex POST request with JSON, headers:
  return new Promise((resolve, reject) => {
    fetch(`https://api.shotstack.io/stage/render/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${shotstackApiKey}`
      },
    }).then(r => {
      resolve(r.json());
    })
    .catch((error) => {
      reject(error)
    })
  })
}

function getRandomMusicUrl() {
  let urls = [
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/Arpent.mp3',
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/Chronos.mp3',
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/Desert_Fox.mp3',
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/Fireworks.mp3',
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/Guerilla_Tactics.mp3',
    'https://s3.amazonaws.com/cdn.mikegajda.com/royal_free_music_public_domain_lower_volume/The_Drama.mp3']
  let randomIndex = Math.floor(Math.random() * urls.length)
  return urls[randomIndex]
}

function getReactionPhotoUrl(reaction){
  return `https://s3.amazonaws.com/cdn.mikegajda.com/dever_reaction_smaller/${reaction}.png`
}

async function createReactionBaseImage(baseImage){

  return await baseImage.getBufferAsync("image/jpeg");

}

async function createReactionWithSpeechBubble(baseImage, reactionText){
  let speechBubbleUrl = 'https://s3.amazonaws.com/cdn.mikegajda.com/dever_reaction_story_assets/speech_bubble.png'

  let speechBubbleImage = await Jimp.read(speechBubbleUrl)

  baseImage = baseImage.composite(speechBubbleImage, 90, 1040);

  let textFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Medium-40/GothicA1-Medium.ttf.fnt`);

  reactionText = fixTitle(reactionText)
  baseImage = await baseImage.print(textFont, 135, 1115, reactionText, 800);

  return await baseImage.getBufferAsync("image/jpeg");

}
async function processDeverReaction(reaction){
  let baseImage = await new Jimp(820, 185)
  let speechBubbleImageUrl = 'https://s3.amazonaws.com/cdn.mikegajda.com/dever_reaction_smaller/dever_speech_bubble_new.png'
  let speechBubble = await Jimp.read(speechBubbleImageUrl)

  let reactionImage = await Jimp.read(getReactionPhotoUrl(reaction))
  baseImage = baseImage.composite(reactionImage, 0, 15)
  baseImage = baseImage.composite(speechBubble, 173, 37)

  let textFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

  let reactionText = fixTitle(getDeverReactionText(reaction))
  baseImage = await baseImage.print(textFont, 215, 48, reactionText, 590);

  return baseImage

}
async function processReaction(urlToParse, reaction, reactionText){
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);

  let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
  let ogData = JSON.parse(stringifiedJson)

  let backgroundImageUrl = 'https://s3.amazonaws.com/cdn.mikegajda.com/dever_reaction_story_assets/background_gradient.png'
  let backgroundImage = await Jimp.read(backgroundImageUrl)
  backgroundImage = backgroundImage.resize(1080, 1920)

  let reactionImage = await Jimp.read(getReactionPhotoUrl(reaction))

  let igFeedImageUrl = `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_ig_feed.jpg`
  let igFeedImage = await Jimp.read(igFeedImageUrl)
  igFeedImage = igFeedImage.resize(729, 729)

  let baseImage = backgroundImage.composite(igFeedImage, 175, 185);
  baseImage = baseImage.composite(reactionImage, 336, 705);


  let reactionBaseImageBufferPromise = createReactionBaseImage(baseImage);
  let reactionImageWithSpeechBubbleBufferPromise = createReactionWithSpeechBubble(baseImage, reactionText);

  let pollyBufferPromise = getPollySpeechBufferForText(reactionText, "Joey", false);


  let [reactionBaseImageBuffer, reactionImageWithSpeechBubbleBuffer, pollyBuffer] = await Promise.all(
      [reactionBaseImageBufferPromise, reactionImageWithSpeechBubbleBufferPromise, pollyBufferPromise])
  console.log("got image buffers")

  let reactionBaseImageBufferAwsPromise = uploadBufferToAmazon(reactionBaseImageBuffer,
      `${urlHashKey}_reaction_base.jpg`);

  let reactionImageWithSpeechBubbleBufferAwsPromise = uploadBufferToAmazon(reactionImageWithSpeechBubbleBuffer,
      `${urlHashKey}_reaction_with_speech_bubble.jpg`);

  let pollyBufferAwsPromise = uploadBufferToAmazon(pollyBuffer,
      `${urlHashKey}_reaction.mp3`);

  let [response1, response2, response3, response4, response5, response6] = await Promise.all(
      [reactionBaseImageBufferAwsPromise, reactionImageWithSpeechBubbleBufferAwsPromise, pollyBufferAwsPromise])
  console.log("awsResponse=", response1.Location);
  console.log("awsResponse=", response2.Location);
  console.log("awsResponse=", response3.Location);

  let shotStackPostBody = {
    "timeline": {
      "background": "#01BC84",
      "tracks": [
        {
          "clips": [
            {
              "asset": {
                "type": "audio",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_reaction.mp3`
              },
              "start": 0,
              "length": 15
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_reaction_with_speech_bubble.jpg`
              },
              "start": 1,
              "length": 14,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_reaction_base.jpg`
              },
              "start": 0,
              "length": 5,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        }
      ],
      "soundtrack": {
        "src": `${getRandomMusicUrl()}`,
        "effect": "fadeInFadeOut",
      }
    },
    "output": {
      "format": "mp4",
      "resolution": "1080",
      "aspectRatio": "9:16"
    }
  }
  let shotStackResponse = await postToShotStack(shotStackPostBody)
  ogData['reactionShotStackResponse'] = shotStackResponse;
  let updatedOgDataResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      `${urlHashKey}.json`)
  return shotStackResponse
}

async function createShotStack(urlToParse) {
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);
  //
  let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
  let ogData = JSON.parse(stringifiedJson)

  let shotStackPostBody = {
    "timeline": {
      "background": "#01BC84",
      "tracks": [
        {
          "clips": [
            {
              "asset": {
                "type": "audio",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}.mp3`
              },
              "start": 1,
              "length": 9
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_ig_story.jpg`
              },
              "start": 1,
              "length": 9,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": `https://s3.amazonaws.com/cdn.mikegajda.com/${urlHashKey}_ig_story_without_text.jpg`
              },
              "start": 0,
              "length": 5,
              "transition": {
                "in": "reveal"
              }
            }
          ]
        }
      ],
      "soundtrack": {
        "src": `${getRandomMusicUrl()}`,
        "effect": "fadeInFadeOut",
      }
    },
    "output": {
      "format": "mp4",
      "resolution": "1080",
      "aspectRatio": "9:16"
    }
  }
  let shotStackResponse = await postToShotStack(shotStackPostBody)
  ogData['shotStackResponse'] = shotStackResponse;
  let updatedOgDataResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      `${urlHashKey}.json`)
  console.log("updatedOgDataLocation=", updatedOgDataResponse.Location);
  return shotStackResponse

}

async function getShotStack(urlToParse, type = 'Regular') {
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);
  let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
  let ogData = JSON.parse(stringifiedJson)

  if (type === 'Regular' && ogData['shotStackResponse'] && ogData['shotStackResponse']['success']) {
    let shotStackId = ogData['shotStackResponse']['response']['id']
    let shotStackResponse = await getShotStackResult(shotStackId)
    if (shotStackResponse['success']) {
      return shotStackResponse['response']['url']
    } else {
      return shotStackResponse
    }
  }
  else if (type === 'Reaction' && ogData['reactionShotStackResponse'] && ogData['reactionShotStackResponse']['success']){
    let shotStackId = ogData['reactionShotStackResponse']['response']['id']
    let shotStackResponse = await getShotStackResult(shotStackId)
    if (shotStackResponse['success']) {
      return shotStackResponse['response']['url']
    } else {
      return shotStackResponse
    }
  }
}

async function processOgData(ogData, urlHashKey, backgroundColor, includeReaction,
    reaction) {
  let awsResponse

  if (ogData.ogImage && ogData.ogImage.url) {
    let ogImage = await Jimp.read(ogData.ogImage.url)
    if (ogImage.getWidth() > 1080) {
      ogImage = ogImage.resize(1080, Jimp.AUTO);
    }
    ogImage = ogImage.quality(85)

    let imageBufferPromise = ogImage.getBufferAsync("image/jpeg");

    let reactionImage
    if (includeReaction){
      reactionImage = await processDeverReaction(reaction)
    }
    let pollyBufferPromise = getPollySpeechBufferForText(ogData.ogTitle);
    let igFeedBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
        backgroundColor, includeReaction, reactionImage);
    //
    // let igFeedWhiteTextBufferPromise = processIgFeedImageToBuffer(ogData, ogImage,
    //     backgroundColor, '-white');

    let igStoryBufferPromise = processIgStoryImageToBuffer(ogData, ogImage,
        backgroundColor,  includeReaction, reactionImage, true);

    let igStoryBufferWithoutTextPromise = processIgStoryImageToBuffer(ogData,
        ogImage,
        backgroundColor, false, reactionImage, false);

    let [imageBuffer, igFeedBuffer, igStoryBuffer, igStoryWithoutTextBuffer, pollyBuffer] = await Promise.all(
        [imageBufferPromise, igFeedBufferPromise, igStoryBufferPromise,
          igStoryBufferWithoutTextPromise, pollyBufferPromise])
    console.log("got image buffers")

    let imageBufferAwsPromise = uploadBufferToAmazon(imageBuffer,
        `${urlHashKey}.jpg`);

    let igStoryBufferBufferAwsPromise = uploadBufferToAmazon(igStoryBuffer,
        `${urlHashKey}_ig_story.jpg`)

    let igStoryBufferWithoutTextAwsPromise = uploadBufferToAmazon(
        igStoryWithoutTextBuffer,
        `${urlHashKey}_ig_story_without_text.jpg`)

    let igFeedBufferBufferAwsPromise = uploadBufferToAmazon(igFeedBuffer,
        `${urlHashKey}_ig_feed.jpg`);


    // let igFeedWhiteTextBufferBufferAwsPromise = uploadBufferToAmazon(igFeedWhiteTextBuffer,
    //     `${urlHashKey}_ig_feed_white_text.jpg`);

    let pollyBufferAwsPromise = uploadBufferToAmazon(pollyBuffer,
        `${urlHashKey}.mp3`);

    let [response1, response2, response3, response4, response5, response6] = await Promise.all(
        [imageBufferAwsPromise, igStoryBufferBufferAwsPromise,
          igFeedBufferBufferAwsPromise, igStoryBufferWithoutTextAwsPromise,
          pollyBufferAwsPromise])
    console.log("awsResponse=", response1.Location);
    console.log("awsResponse=", response2.Location);
    console.log("awsResponse=", response3.Location);
    console.log("awsResponse=", response4.Location);
    console.log("awsResponse=", response5.Location);

    ogData["processedImageHash"] = `${urlHashKey}.jpg`
  }

  awsResponse = await uploadBufferToAmazon(JSON.stringify(ogData),
      urlHashKey + ".json");
  console.log("awsResponse=", awsResponse.Location);
  return ogData;
}

async function fetchOgMetadataAndImagesAndUploadToAWS(url, urlHashKey,
    backgroundColor, includeReaction, reaction) {

  let ogInfo = await getOpenGraphInfo(url);
  // if there is no url in the metadata, use the one that was requested from
  if (ogInfo['data']['ogUrl'] === undefined) {
    ogInfo['data']['ogUrl'] = url
  }

  console.log("ogInfo=", JSON.stringify(ogInfo))

  if (ogInfo["success"]) {
    ogInfo["data"]["success"] = true
    return await processOgData(ogInfo["data"], urlHashKey, backgroundColor, includeReaction, reaction)
  } else {
    return {
      success: false,
      ogUrl: url
    }
  }
}

function cleanUrl(urlToClean) {
  let parsedUrl = url.parse(urlToClean);
  let cleanUrl = parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname
  console.log("cleanUrl=", cleanUrl);
  return cleanUrl
}

async function processUrl(urlToParse, breakCache, backgroundColor = '01bc84', includeReaction = true, reaction = '') {
  let cleanedUrl = cleanUrl(urlToParse)
  let urlHashKey = stringHash(cleanedUrl);

  let existsInS3 = await checkIfFileExistsInS3(`${urlHashKey}.json`)
  if (existsInS3 && !breakCache) {
    try {
      console.log("found in S3, will return early")
      let stringifiedJson = await getFileInS3(`${urlHashKey}.json`)
      return JSON.parse(stringifiedJson)
    } catch (e) {
      console.error("Error while fetching file, will instead do a new fetch")
      return await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
          urlHashKey,
          backgroundColor, includeReaction, reaction)
    }
  } else {
    let response = await fetchOgMetadataAndImagesAndUploadToAWS(cleanedUrl,
        urlHashKey, backgroundColor, includeReaction, reaction)
    return response
  }
}

function extractHostname(url) {
  var hostname;
  //find & remove protocol (http, ftp, etc.) and get hostname

  if (url.indexOf("//") > -1) {
    hostname = url.split('/')[2];
  } else {
    hostname = url.split('/')[0];
  }

  //find & remove port number
  hostname = hostname.split(':')[0];
  //find & remove "?"
  hostname = hostname.split('?')[0];

  // remove www. if it exists
  if (hostname.indexOf("www.") > -1) {
    hostname = hostname.split('www.')[1];
  }

  return hostname;
}

function fixTitle(title) {
  title = title.replace(/’/g, "'")
  title = title.replace(/‘/g, "'")
  title = title.replace(/"/g, "'")
  title = title.replace(/“/g, "'")
  title = title.replace(/”/g, "'")
  title = title.replace(" — ", "-")
  title = title.replace(" — ", "-")
  return title
}

async function getRelatedHashTags(hashTag, numberOfHashTagsToInclude = 15) {
  return new Promise((resolve, reject) => {
    fetch(`https://apidisplaypurposes.com/tag/${hashTag}`)
    .then(res => res.json())
    .then(json => {
      let results = json['results']
      console.log("length =", results.length)
      if (results.length < numberOfHashTagsToInclude) {
        numberOfHashTagsToInclude = results.length
      }
      let hashtags = ""
      for (let i = 0; i < numberOfHashTagsToInclude; i++) {
        hashtags += `#${results[i]['tag']} `
      }
      resolve(hashtags)
    })
  })

}

async function processIgStoryImageToBuffer(ogData, ogImage, backgroundColor, includeReaction, reactionImage, printText = true ) {
  ogImage = ogImage.cover(1080, 680);
  // let imageBuffer = await ogImage.getBufferAsync("image/jpeg");

  let background = await new Jimp(1080, 1920, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, 100);

  if (includeReaction){
    outputImage = outputImage.composite(reactionImage, 67, 1015)
  }

  if (printText) {
    // generated with https://ttf2fnt.com/
    let titleFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-60/GothicA1-SemiBold.ttf.fnt`);
    let urlFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);


    let url = extractHostname(ogData.ogUrl)
    let title = fixTitle(ogData.ogTitle)

    let maxWidth = 910
    let titleHeight = Jimp.measureTextHeight(titleFont, title, maxWidth);
    let lineHeight = 75
    let lines = titleHeight / lineHeight

    let titleMaxY = 600
    let titleY = titleMaxY - titleHeight
    console.log("igStory titleHeight", titleHeight)
    console.log("igStory lineCount", lines)
    outputImage = await outputImage.print(urlFont, 80, 800, url, maxWidth);
    outputImage = await outputImage.print(titleFont, 80, 850, title, maxWidth);
  } else {
    // generated with https://ttf2fnt.com/
    let urlFont = await Jimp.loadFont(
        `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

    let url = extractHostname(ogData.ogUrl)

    let maxWidth = 910

    outputImage = await outputImage.print(urlFont, 80, 295, url, maxWidth);
  }

  return await outputImage.getBufferAsync("image/jpeg");

}

async function processIgFeedImageToBuffer(ogData, ogImage, backgroundColor, includeReaction, reactionImage) {
  // generated with https://ttf2fnt.com/
  let titleFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-SemiBold-50/GothicA1-SemiBold.ttf.fnt`);
  let urlFont = await Jimp.loadFont(
      `https://s3.amazonaws.com/cdn.mikegajda.com/GothicA1-Regular-32/GothicA1-Regular.ttf.fnt`);

  let url = extractHostname(ogData.ogUrl)
  let title = fixTitle(ogData.ogTitle)

  let titleHeight = Jimp.measureTextHeight(titleFont, title, 1020);
  let lineHeight = 63;
  let linesCount = titleHeight / lineHeight;

  console.log("titleHeight=", titleHeight)
  console.log("linesCount=", linesCount)

  // this is the maximum size of the image, calculated manually
  let maxImageHeight = 819;
  // image should be larger if we don't have a reaction
  if (!includeReaction){
    maxImageHeight += 135
  }
  let imageHeight = maxImageHeight - (linesCount * lineHeight)
  // this is the minimum y axis value, based on the number of lines, this should go up
  // calculated this manually
  let minImageYAxis = 82;
  let imageYAxis = minImageYAxis + (linesCount * lineHeight)

  // now generate everything
  ogImage = ogImage.cover(1080, imageHeight);

  let background = await new Jimp(1080, 1080, `#${backgroundColor}`)

  let outputImage = background.composite(ogImage, 0, imageYAxis);

  if (includeReaction){
    outputImage = outputImage.composite(reactionImage, 130, 887)
  }


  outputImage = await outputImage.print(titleFont, 30, 30, title, 1020);
  // here, the y value is just slightly less than 30 + titleHeight on purpose, so that
  // the url looks more attached to the title
  outputImage = await outputImage.print(urlFont, 30, 22 + titleHeight, url, 1020);


  return await outputImage.getBufferAsync("image/jpeg");

}

// (async () => {
//   try {
//     let ogData = await processUrl(
//         'https://www.nytimes.com/interactive/2020/06/07/us/george-floyd-protest-aerial-photos.html?action=click&module=Top%20Stories&pgtype=Homepage', true)
//     // await processIgStoryImageToBuffer(ogData);
//     // await processIgFeedImageToBuffer(ogData);
//   } catch (e) {
//     console.error(e)
//     // Deal with the fact the chain failed
//   }
// })();

module.exports.processUrl = processUrl
module.exports.createShotStack = createShotStack
module.exports.getShotStack = getShotStack
module.exports.processReaction = processReaction
module.exports.getRelatedHashTags = getRelatedHashTags
