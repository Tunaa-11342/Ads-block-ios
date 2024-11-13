console.log(`spotify-json-2023.06.13`);
let url = $request.url;
// console.log(`url:${url}`);
if (url.includes('platform=iphone')) {
    url = url.replace(/platform=iphone/, 'platform=ipad');
    // console.log(`platform:${url}`);
} else {
    console.log('');
}
$done({
    url
});
