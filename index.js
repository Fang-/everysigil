const fs = require('fs');

const Twit = require('twit');
const Twitter = new Twit(require('./config.js'));

const ob = require('urbit-ob');
const { sigil, stringRenderer } = require('@tlon/sigil-js');

const RNG = require('rng-js');

const { convert: svgToPng } = require('convert-svg-to-png');

const STATE_FILE = 'posted.json';
const SIGIL_SIZE = 1024;
const POST_MSECS = 6 * 60 * 60 * 1000;

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
  return svgToPng(svg, {
    background: 'black',
    width: (SIGIL_SIZE/9*16), // avoid twitter crop
    height: SIGIL_SIZE
  }); // promise
}

const pickP = function(s) {
  let rng = new RNG(s);
  let p;
  do {
    p = rng.random(0, 0xffffffff+1);
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

const runNext = function() {
  let n = (new Date()).getTime();
  let s = Math.floor(n / POST_MSECS);
  setTimeout(run, (POST_MSECS - n % POST_MSECS));
}

const run = async function() {
  let n = (new Date()).getTime();
  let s = Math.floor(n / POST_MSECS);
  setTimeout(run, (POST_MSECS - n % POST_MSECS));
  try {
    const p = pickP(s);
    const png = await renderPng(p);
    const imgId = await uploadPng(png);
    await sendTweet(p, imgId);
    logP(p);
  } catch (e) {
    console.error('failed to post', e);
  }
  return;
}

loadState().then(runNext);
