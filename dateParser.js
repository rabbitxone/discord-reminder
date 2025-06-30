const MONTHS_MAP = {
    'styczeń': 0, 'styczen': 0, 'stycznia': 0, 'sty': 0, 'styczniu': 0,
    'luty': 1, 'lutego': 1, 'lut': 1, 'lutym': 1,
    'marzec': 2, 'marca': 2, 'mar': 2, 'marz': 2, 'marcu': 2,
    'kwiecień': 3, 'kwietnia': 3, 'kwi': 3, 'kwie': 3, 'kwietniu': 3,
    'maj': 4, 'maja': 4, 'maju': 4,
    'czerwiec': 5, 'czerwca': 5, 'cze': 5, 'czerw': 5, 'czerwcu': 5,
    'lipiec': 6, 'lipca': 6, 'lip': 6, 'lipcu': 6,
    'sierpień': 7, 'sierpnia': 7, 'sie': 7, 'sierp': 7, 'sierpniu': 7,
    'wrzesień': 8, 'września': 8, 'wrz': 8, 'wrze': 8, 'wrześniu': 8,
    'październik': 9, 'października': 9, 'paź': 9, 'pazdziernik': 9, 'pazdziernika': 9, 'paz': 9, 'październiku': 9,
    'listopad': 10, 'listopada': 10, 'lis': 10, 'list': 10, 'listopadzie': 10,
    'grudzień': 11, 'grudnia': 11, 'gru': 11, 'grud': 11, 'grudniu': 11
};
const WEEKDAYS_MAP = {
    'poniedziałek': 0, 'poniedzialek': 0, 'pon': 0, 'pn': 0, 'pn.': 0, 'pon.': 0,
    'wtorek': 1, 'wto': 1, 'wt': 1, 'wt.': 1, 'wto.': 1,
    'środa': 2, 'sroda': 2, 'sro': 2, 'sr': 2, 'sr.': 2, 'sro.': 2, 'środę': 2, 'środe': 2, 'srodę': 2, 'srode': 2,
    'czwartek': 3, 'czw': 3, 'cz': 3, 'czw.': 3, 'cz.': 3,
    'piątek': 4, 'piatek': 4, 'pią': 4, 'pia': 4, 'pt': 4, 'pt.': 4, 'pia.': 4, 'pią.': 4,
    'sobota': 5, 'sob': 5, 'so': 5, 'sb': 5, 'sb.': 5, 'sob.': 5, 'so.': 5, 'sobotę': 5, 'sobote': 5,
    'niedziela': 6, 'niedz': 6, 'nie': 6, 'ndz': 6, 'nd': 6, 'niedz.': 6, 'nie.': 6, 'ndz.': 6, 'nd.': 6, 'niedzielę': 6, 'niedziele': 6
};
const TODAY_WORDS = /dzisiaj|dziś|dzis/;
const TOMORROW_WORDS = /jutro/;
const DAY_AFTER_TOMORROW_WORDS = /pojutrze|następnego dnia|nastepnego dnia|kolejnego dnia/;

function parseDate(text, now = new Date()) {
    const originalText = text;
    text = text.toLowerCase().trim();
    let date = new Date(now);
    let m;
    let ruleMatched = false;

    // 1. Godzina i minuta
    let timeSet = false;
    let hour = 9, minute = 0; // Domyślnie 9:00

    const atThisTimeRegex = /o tej( samej)? porze|w tej samej godzinie|o tej samej godzinie|o tej godzinie co teraz/;
    if (atThisTimeRegex.test(text)) {
        hour = now.getHours();
        minute = now.getMinutes();
        text = text.replace(atThisTimeRegex, '').trim();
        timeSet = true;
        ruleMatched = true;
    } else if (m = text.match(/(?:o |na |godzina )?(\d{1,2}):(\d{2})/)) {
        hour = parseInt(m[1], 10);
        minute = parseInt(m[2], 10);
        text = text.replace(m[0], '').trim();
        timeSet = true;
        ruleMatched = true;
    }

    // 2. Data
    // Dni tygodnia
    if (m = text.match(/^(?:(?:w|na) )?(ten|tę|najbliższy|najbliższą|przyszły|przyszłą|następny|następną)? ?([a-ząćęłńóśźż]+)$/)) {
        const weekdayName = m[2];
        const weekday = WEEKDAYS_MAP[weekdayName];
        if (weekday !== undefined) {
            ruleMatched = true;
            const modifier = m[1] || '';
            const isNextWeek = /przyszły|przyszłą|następny|następną/.test(modifier);
            let currentDay = (date.getDay() + 6) % 7; // 0 = pon, 6 = niedz
            let diff = (weekday - currentDay + 7) % 7;
            
            if (diff === 0) {
                diff = 7; // za tydzień
            }
            
            if (isNextWeek) {
                diff += 7;
            }
            
            date.setDate(date.getDate() + diff);
        }
    }

    if (!ruleMatched && (m = text.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/))) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = m[3] ? parseInt(m[3], 10) : date.getFullYear();
        date.setFullYear(year, month, day);
        if (!m[3] && new Date(year, month, day) < now) {
            date.setFullYear(year + 1);
        }
        ruleMatched = true;
    } else if (TODAY_WORDS.test(text)) {
        ruleMatched = true;
    } else if (TOMORROW_WORDS.test(text)) {
        date.setDate(date.getDate() + 1);
        ruleMatched = true;
    } else if (DAY_AFTER_TOMORROW_WORDS.test(text)) {
        date.setDate(date.getDate() + 2);
        text = text.replace(DAY_AFTER_TOMORROW_WORDS, '').trim();
        ruleMatched = true;
    } else if (!ruleMatched && (m = text.match(/^(?:(?:w|na) )?(?:(\d{1,2}) )?([a-ząćęłńóśźż]+)(?: (\d{4}))?$/))) {
        const monthName = m[2];
        const month = MONTHS_MAP[monthName];

        if (month !== undefined) {
            const day = m[1] ? parseInt(m[1], 10) : 1;
            const year = m[3] ? parseInt(m[3], 10) : date.getFullYear();
            
            const tempDate = new Date(year, month, day);
            
            if (!m[3] && tempDate < now) {
                date.setFullYear(year + 1, month, day);
            } else {
                date.setFullYear(year, month, day);
            }
            text = text.replace(m[0], '').trim();
            ruleMatched = true;
        } else {
            const weekday = WEEKDAYS_MAP[monthName];
            if (weekday !== undefined) {
                ruleMatched = true;
                let currentDay = (date.getDay() + 6) % 7;
                let diff = (weekday - currentDay + 7) % 7;
                
                if (diff === 0) {
                    diff = 7;
                }
                
                date.setDate(date.getDate() + diff);
            }
        }
    } else if (m = text.match(/za (\d+|jeden|jedną|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć) ?(minut|min|godzin|godz|h|dni|dzień|tygodni|tydzień|miesięcy|miesiąc|lat|lata|rok)/)) {
        const numStr = m[1];
        const unit = m[2];
        let amount = /^\d+$/.test(numStr) ? parseInt(numStr, 10) : WORD_NUMBERS[numStr];

        if (/minut|min/.test(unit)) date.setMinutes(date.getMinutes() + amount);
        else if (/godzin|godz|h/.test(unit)) date.setHours(date.getHours() + amount);
        else if (/dni|dzień/.test(unit)) date.setDate(date.getDate() + amount);
        else if (/tygodni|tydzień/.test(unit)) date.setDate(date.getDate() + 7 * amount);
        else if (/miesięcy|miesiąc/.test(unit)) date.setMonth(date.getMonth() + amount);
        else if (/lat|lata|rok/.test(unit)) date.setFullYear(date.getFullYear() + amount);
        ruleMatched = true;
    }

    if (!ruleMatched) {
        return null;
    }

    // 3. Ustawienie godziny i minuty
    date.setHours(hour, minute, 0, 0);

    if (!timeSet && date < now) {
        return null;
    }
    if (timeSet && date < now) {
        date.setDate(date.getDate() + 1);
    }
    
    return date;
}

const WORD_NUMBERS = {
    'jeden': 1, 'jedna': 1, 'jedno': 1, 'pierwszy': 1, 'pierwsza': 1, 'pierwszą': 1, 'pierwsze': 1,
    'dwa': 2, 'dwie': 2, 'drugi': 2, 'druga': 2, 'drugą': 2, 'drugie': 2,
    'trzy': 3, 'trzy': 3, 'trzeci': 3, 'trzecia': 3, 'trzecią': 3, 'trzecie': 3,
    'cztery': 4, 'czwarty': 4, 'czwarta': 4, 'czwartą': 4, 'czwarte': 4,
    'pięć': 5, 'pięć': 5, 'piąty': 5, 'piąta': 5, 'piątą': 5, 'piąte': 5,
    'sześć': 6, 'szósty': 6, 'szósta': 6, 'szóstą': 6, 'szóste': 6,
    'siedem': 7, 'siódmy': 7, 'siódma': 7, 'siódmą': 7, 'siódme': 7,
    'osiem': 8, 'ósmy': 8, 'ósma': 8, 'ósmą': 8, 'ósme': 8,
    'dziewięć': 9, 'dziewiąty': 9, 'dziewiąta': 9, 'dziewiątą': 9, 'dziewiąte': 9,
    'dziesięć': 10, 'dziesiąty': 10, 'dziesiąta': 10, 'dziesiątą': 10, 'dziesiąte': 10,
    'jedenaście': 11, 'jedenasty': 11, 'jedenasta': 11, 'jedenastą': 11, 'jedenaste': 11,
    'dwanaście': 12, 'dwunasty': 12, 'dwunasta': 12, 'dwunastą': 12, 'dwunaste': 12,
    'trzynaście': 13, 'trzynasty': 13, 'trzynasta': 13, 'trzynastą': 13, 'trzynaste': 13,
    'czternaście': 14, 'czternasty': 14, 'czternasta': 14, 'czternastą': 14, 'czternaste': 14,
    'piętnaście': 15, 'piętnasty': 15, 'piętnasta': 15, 'piętnastą': 15, 'piętnaste': 15,
    'szesnaście': 16, 'szesnasty': 16, 'szesnasta': 16, 'szesnastą': 16, 'szesnaste': 16,
    'siedemnaście': 17, 'siedemnasty': 17, 'siedemnasta': 17, 'siedemnastą': 17, 'siedemnaste': 17,
    'osiemnaście': 18, 'osiemnasty': 18, 'osiemnasta': 18, 'osiemnastą': 18, 'osiemnaste': 18,
    'dziewiętnaście': 19, 'dziewiętnasty': 19, 'dziewiętnasta': 19, 'dziewiętnastą': 19, 'dziewiętnaste': 19,
    'dwadzieścia': 20, 'dwudziesty': 20, 'dwudziesta': 20, 'dwudziestą': 20, 'dwudzieste': 20,
    'dwadzieścia jeden': 21, 'dwudziesty pierwszy': 21, 'dwudziesta pierwsza': 21, 'dwudziestą pierwszą': 21, 'dwudzieste pierwsze': 21,
    'dwadzieścia dwa': 22, 'dwudziesty drugi': 22, 'dwudziesta druga': 22, 'dwudziestą drugą': 22, 'dwudzieste drugie': 22,
    'dwadzieścia trzy': 23, 'dwudziesty trzeci': 23, 'dwudziesta trzecia': 23, 'dwudziestą trzecią': 23, 'dwudzieste trzecie': 23,
    'dwadzieścia cztery': 24, 'dwudziesty czwarty': 24, 'dwudziesta czwarta': 24, 'dwudziestą czwartą': 24, 'dwudzieste czwarte': 24,
    'dwadzieścia pięć': 25, 'dwudziesty piąty': 25, 'dwudziesta piąta': 25, 'dwudziestą piątą': 25, 'dwudzieste piąte': 25,
    'dwadzieścia sześć': 26, 'dwudziesty szósty': 26, 'dwudziesta szósta': 26, 'dwudziestą szóstą': 26, 'dwudzieste szóste': 26,
    'dwadzieścia siedem': 27, 'dwudziesty siódmy': 27, 'dwudziesta siódma': 27, 'dwudziestą siódmą': 27, 'dwudzieste siódme': 27,
    'dwadzieścia osiem': 28, 'dwudziesty ósmy': 28, 'dwudziesta ósma': 28, 'dwudziestą ósmą': 28, 'dwudzieste ósme': 28,
    'dwadzieścia dziewięć': 29, 'dwudziesty dziewiąty': 29, 'dwudziesta dziewiąta': 29, 'dwudziestą dziewiątą': 29, 'dwudzieste dziewiąte': 29,
    'trzydzieści': 30, 'trzydziesty': 30, 'trzydziesta': 30, 'trzydziestą': 30, 'trzydzieste': 30,
    'trzydzieści jeden': 31, 'trzydziesty pierwszy': 31, 'trzydziesta pierwsza': 31, 'trzydziestą pierwszą': 31, 'trzydzieste pierwsze': 31,
    'trzydzieści dwa': 32, 'trzydziesty drugi': 32, 'trzydziesta druga': 32, 'trzydziestą drugą': 32, 'trzydzieste drugie': 32,
}

module.exports = { parseDate };