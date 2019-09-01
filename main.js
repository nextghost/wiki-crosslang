var slow_url = null;

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

function process_langlist() {
	if (this.readyState !== XMLHttpRequest.DONE) {
		return;
	}

	let elem1 = document.getElementById('lang1_id');
	let elem2 = document.getElementById('lang2_id');
	let lang = get_preferred_lang();
	let defurl = null;

	if (this.status !== 200) {
		let elem = document.getElementById('results');
		elem.innerHTML = '';
		elem.appendChild(create_element('div',
			['Could not load list of Wikisource languages. Please reload the page.'],
			{class:'error'}));
		return;
	}

	let data = JSON.parse(this.responseText);
	let lang_list = data.results.bindings;

	for (idx in lang_list) {
		let item = lang_list[idx];
		let langname = titlecase(item.langname.value);
		elem1.add(create_element('option', [langname],
			{value:item.url.value}));
		elem2.add(create_element('option', [langname],
			{value:item.url.value}));

		if (item.langcode.value === lang) {
			defurl = item.url.value;
		}

		if (item.langcode.value === 'en') {
			slow_url = item.url.value;
		}
	}

	if (defurl) {
		elem1.value = defurl;
	}
}

function process_pagelist(xhr, header) {
	if (xhr.readyState !== XMLHttpRequest.DONE) {
		return;
	}

	let elem = document.getElementById('results');

	if (xhr.status !== 200) {
		elem.innerHTML = '';
		elem.appendChild(create_element('div',
			['Wikidata request failed. Please try again later.'],
			{class:'error'}));
		return;
	}

	let data = JSON.parse(xhr.responseText);
	let result_list = data.results.bindings;
	let rowlist = [create_element('tr', [
		create_element('th', [header[0]]),
		create_element('th', [header[1]])
	])];

	for (idx in result_list) {
		let item = result_list[idx];
		rowlist.push(create_element('tr', [
			create_element('td', [
				create_element('a', [item.srcName.value],
					{href:item.srcLink.value})
			]),
			create_element('td', [
				create_element('a', [item.dstName.value],
					{href:item.dstLink.value})
			]),
		]));
	}

	elem.innerHTML = '';
	elem.appendChild(create_element('div',
		['Found ' + result_list.length + ' works.']));
	elem.appendChild(create_element('table', rowlist));
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

function init_langlist() {
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
		}\
		ORDER BY STR(?langname)';
	send_query(query, process_langlist);
}

function submit_form() {
	let elem1 = document.getElementById('lang1_id');
	let elem2 = document.getElementById('lang2_id');
	let baseurl1 = elem1.value;
	let baseurl2 = elem2.value;
	let elem = document.getElementById('results');
	let swap = false;

	if (!baseurl1 || !baseurl2) {
		window.alert("Select both languages.");
		return;
	} else if (baseurl1 == baseurl2) {
		window.alert("Pick two different languages.");
		return;
	}

	let langname1 = elem1.options[elem1.selectedIndex].innerText;
	let langname2 = elem2.options[elem2.selectedIndex].innerText;

	// Select WikiSource pages available in both languages.
	// Ignore authors and WikiSource meta pages.
	let query = "SELECT ?srcLink ?srcName ?dstLink ?dstName WHERE {";
	let qurl1 = "?srcLink schema:isPartOf <" + baseurl1 + ">;\
		schema:name ?srcName;\
		schema:about ?item.";
	let qurl2 = "?dstLink schema:isPartOf <" + baseurl2 + ">;\
		schema:name ?dstName;\
		schema:about ?item.";

	// Performance optimization of the Wikidata SPARQL query
	if (baseurl1 === slow_url) {
		query += qurl2 + qurl1;
	} else {
		query += qurl1 + qurl2;
	}

	query += "MINUS {?item wdt:P31 wd:Q5.}\
		MINUS {?item wdt:P31/wdt:P279* wd:Q21070568.}\
		MINUS {?item wdt:P31/wdt:P279* wd:Q16334295.}\
		MINUS {?item wdt:P31/wdt:P279* wd:Q17442446.}\
	}";

	elem.innerHTML = 'Please wait. This may take a minute. Literally.';
	send_query(query, function() {
		process_pagelist(this, [langname1, langname2]);
	});
}

add_init_callback(init_langlist);
