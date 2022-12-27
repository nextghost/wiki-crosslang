/*
Wiki-crosslang - App for looking up bilingual texts on Wikisource
Copyright (C) 2019 next_ghost

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

function add_init_callback(callback) {
	if (document.readyState == 'complete') {
		callback();
		return;
	}

	document.addEventListener('readystatechange', function(e) {
		if (document.readyState == 'complete') {
			return callback();
		}

		return true;
	});
}

function create_element(tag, content=[], attrs={}) {
	let elem = document.createElement(tag);

	for (let key in attrs) {
		elem.setAttribute(key, attrs[key]);
	}

	for (let idx in content) {
		let val = content[idx];

		if ((typeof val) == 'string') {
			val = document.createTextNode(val);
		}

		elem.appendChild(val);
	}

	return elem;
}

function get_preferred_lang() {
	if (navigator.language) {
		return navigator.language.substr(0, 2);
	}

	return 'en';
}

locale_cmp = new Intl.Collator(get_preferred_lang()).compare;

function titlecase(arg) {
	let start = true;

	for (let i = 0; i < arg.length; i++) {
		if (arg[i] == ' ') {
			start = true;
		} else if (start) {
			arg = arg.substring(0, i) +
				arg[i].toLocaleUpperCase() +
				arg.substring(i+1);
			start = false;
		}
	}

	return arg;
}

function send_query(sparql, callback) {
	let xhr = new XMLHttpRequest();
	let url = 'https://query.wikidata.org/sparql?query=';
	url += encodeURIComponent(sparql) + '&format=json';
	xhr.open('GET', url, true);
	xhr.onreadystatechange = callback;
	xhr.timeout = 120000;
	xhr.send();
	return xhr;
}

function query_ws_langlist(callback) {
	let lang = get_preferred_lang();
	let query = 'SELECT ?url ?langcode ?langname WHERE {\
		?item wdt:P31 wd:Q15156455;\
		      wdt:P856 ?url;\
		      wdt:P424 ?langcode;\
		FILTER(?langcode != "mul").\
		OPTIONAL {\
		  ?item wdt:P407/rdfs:label ?preflangname.\
		  FILTER(LANG(?preflangname) = "' + lang + '").\
		}\
		OPTIONAL {\
		  ?item wdt:P407/rdfs:label ?enlangname.\
		  FILTER(LANG(?enlangname) = "en").\
		}\
		BIND(LCASE(COALESCE(?preflangname, ?enlangname)) AS ?langname)\
		}';
	send_query(query, callback);
}

function ws_langlist_cmp(a, b) {
	return locale_cmp(a.langname.value, b.langname.value);
}

function sparql_escape(str) {
	str = str.replace('\\', '\\\\').replace('"', '\\"');
	return str.replace("'", "\\'").replace('\n', '\\n');
}
