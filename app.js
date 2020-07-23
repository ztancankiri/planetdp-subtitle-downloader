const axios = require('axios');
const cheerio = require('cheerio');
const querystring = require('querystring');
const fs = require('fs');

function parseCookies(cookies) {
    if (!cookies || cookies === null) {
        return null;
    }

    return cookies.reduce((arr, cookie) => {
        if (!cookie) {
            return arr;
        }

        let temp = cookie.split(';');

        if (!temp) {
            return arr;
        }

        temp = temp[0];

        if (!temp) {
            return arr;
        }

        temp = temp.split('=');

        if (!temp) {
            return arr;
        }

        arr.push({ key: temp[0], value: temp[1] });
        return arr;
    }, []);
}

async function getFile(subtitle_url) {
    const response = await axios.get(subtitle_url);

    const sessionCookies = response.headers['set-cookie'];
    const cookies = parseCookies(sessionCookies);

    let cookie = cookies.reduce((result, cookie) => {
        result += cookie.key + '=' + cookie.value + '; ';
        return result;
    }, '');

    const $ = cheerio.load(response.data);

    const token = $('#dlform').find('input[name="_token"]').val();

    const download_btn = $('a.download_btn_enable');
    const subtitle_id = download_btn.attr('rel-id');
    const uniquekey = download_btn.attr('rel-tag');

    const payload = querystring.stringify({
        "_token": token,
        "_method": "POST",
        "subtitle_id": subtitle_id,
        "uniquekey": uniquekey,
        "filepath": ""
    });

    const file = await axios.post('https://www.planetdp.org/subtitle/download', payload, {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookie
        },
        responseType: 'stream'
    });

    const file_name = file.headers['content-disposition'].replace('attachment; filename=', '');

    const writer = fs.createWriteStream(file_name);
    file.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function main(imdb_id) {
    try {
        const query = await axios.get(`https://www.planetdp.org/movie/search/?title=${imdb_id}`);

        const $ = cheerio.load(query.data);

        const table = $('#subtable');

        const tbody = table.find('tbody').toArray().reduce((arr, current) => {
            if ($(current).text().length > 0) {
                arr.push(current);
            }

            return arr;
        }, []);

        const result = [];

        for (let i = 0; i < tbody.length; i++) {
            const trs = $(tbody[i]).find('tr.row1, tr.row2');

            for (let j = 0; j < trs.length; j += 2) {
                const tr = $(trs[j]);
                const block = tr.find('td.t-content-one');

                const subtitle = {};

                subtitle.title = block.find('a').text().trim();

                let temp = block.find('span:not([itemprop="subtitleLanguage"])').text().trim();

                if (temp.includes('-')) {
                    temp = temp.split('-');
                    subtitle.season = temp[0].split(':')[1];
                    subtitle.episode = temp[1].split(':')[1];
                }

                subtitle.lang = block.find('span[itemprop="subtitleLanguage"]').text().trim();
                subtitle.fps = tr.find('td.t-content3').text().trim();
                subtitle.files = tr.find('td.t-content4').text().trim();
                subtitle.format = tr.find('td.t-content5').text().trim();
                subtitle.translator = tr.find('td.t-content5').text().trim();
                subtitle.download = 'https://planetdp.org' + tr.find('a.download-btn').attr('href');
                subtitle.release = $(trs[j + 1]).find('td:not(.tdcen)').find('span').text().replace('Sürüm:', '').replace('Not:', ', Not:').trim();

                let isAdded = false;
                for (let k = 0; k < result.length; k++) {
                    if (result[k].season === subtitle.season) {
                        result[k].subtitles.push(subtitle);
                        isAdded = true;
                    }
                }

                if (!isAdded) {
                    temp = {};
                    temp.season = subtitle.season;
                    temp.subtitles = [];
                    temp.subtitles.push(subtitle);
                    result.push(temp);
                }

                // await getFile(subtitle.download);
            }
        }

        console.log(result[0].subtitles[0]);
    }
    catch (error) {
        console.log(error);
    }
}

main('tt6048922');