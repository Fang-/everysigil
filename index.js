const fs = require('fs');

const Twit = require('twit');
const Twitter = new Twit(require('./config.js'));

const ob = require('urbit-ob');
const { sigil, stringRenderer } = require('@tlon/sigil-js');

const { convert: svgToPng } = require('convert-svg-to-png');

const STATE_FILE = 'posted.json';
const SIGIL_SIZE = 1024;
const POST_HOURS = 6;

let posted = {};

//  loadState: load or initialize state
//
const loadState = async function() {
  if (fs.existsSync(STATE_FILE)) {
    console.log('Loading state from disk...');
    posted = JSON.parse(fs.readFileSync(STATE_FILE));
  }

  return;
};

//  saveState: write state to file
//
const saveState = function() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(posted));
}

const renderSvg = function(p) {
  return sigil({
    patp: ob.patp(p),
    renderer: stringRenderer,
    size: SIGIL_SIZE,
    colors: ['black', 'white'],
  });
}

const renderPng = function(p) {
  const svg = renderSvg(p);
  return svgToPng(svg, {width: SIGIL_SIZE, height: SIGIL_SIZE}); // promise
}

const pickP = function() {
  let p;
  do {
    p = Math.floor(Math.random() * (0xffffffff+1));
  } while (!!posted[p]);
  return p;
}

const logP = function(p) {
  console.log('posted', ob.patp(p));
  posted[p] = true;
  saveState();
}

const uploadPng = async function(png) {
  const res = await Twitter.post('media/upload', { media_data: Buffer.from(png).toString('base64') });
  if (res.err) throw res.err;
  if (!res.data.media_id_string) throw 'no media id';
  return res.data.media_id_string;
}

const sendTweet = async function(p, mediaId) {
  const params = { status: ob.patp(p), media_ids: [mediaId] }
  const res = await Twitter.post('statuses/update', params);
  if (res.err) throw res.err;
  return;
}

const run = async function() {
  try {
    const p = pickP();
    const png = await renderPng(p);
    const imgId = await uploadPng(png);
    await sendTweet(p, imgId);
    logP(p);
  } catch (e) {
    console.error('failed to post', e);
  }
  setTimeout(run, POST_HOURS * 1000 * 60 * 60);
  return;
}

loadState().then(run);
