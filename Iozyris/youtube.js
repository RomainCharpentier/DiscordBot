var request = require('superagent');

// https://console.developers.google.com/
const API_KEY = "AIzaSyBC9YI7tqq3Pnuh01Ew9iAUoOTmZaN0dzg";
const WATCH_VIDEO_URL = "https://www.youtube.com/watch?v=";

exports.watchVideoUrl = WATCH_VIDEO_URL;

exports.search = function search(searchKeywords, callback) {
    var requestUrl = 'https://www.googleapis.com/youtube/v3/search' + `?part=snippet&q=${escape(searchKeywords)}&key=${API_KEY}`;
    request(requestUrl, (error, response) => {
        if (!error && response.statusCode == 200) {
            var body = response.body;
            if (body.items.length == 0) {
                defaultChannel.send("Your search gave 0 results");
                return;
            }

            for (var item of body.items) {
                if (item.id.kind === 'youtube#video') {
                    callback(item.id.videoId, item.snippet.title, item.snippet.thumbnails.medium.url);
                    return; // prevent adding entire list of youtube videos
                }
            }
        }
        else {
            console.log("Unexpected error when searching YouTube");
            return;
        }
    });

    return;
};