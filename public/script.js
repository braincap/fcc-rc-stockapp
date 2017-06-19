'use strict';
var socket = io.connect({ 'forceNew': true });

document.querySelector('#submit').addEventListener('click', function () {
  socket.emit('stock', document.querySelector('#input').value);
  return false;
});

var data = {};
const todayDate = moment().format('YYYY-MM-DD');
const lastYearDate = moment(todayDate).subtract(1, 'year').add(1, 'day').format('YYYY-MM-DD');
const lastQuarterDate = moment(todayDate).subtract(3, 'month').add(1, 'day').format('YYYY-MM-DD');
const lastMonthDate = moment(todayDate).subtract(1, 'month').add(1, 'day').format('YYYY-MM-DD');

var margin = { top: 100, right: 100, bottom: 100, left: 100 };

var width = 600 - margin.left - margin.right;
var height = 600 - margin.top - margin.bottom;

// Set the ranges
var x = d3.scaleTime().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);
var colors = d3.scaleOrdinal(d3.schemeCategory10);

// Define the axes
var parseDate = d3.timeParse('%Y-%m-%d');

// Define the line
var priceLine = d3.line()
  .x(d => x(d.closeDate))
  .y(d => y(d.closeVal));

var chart = d3.select('.chart')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('class', 'main')
  .attr('transform', `translate(${margin.left},${margin.top})`);

socket.on('stockNew', newStockData => {
  if (newStockData === 'exists' || newStockData === 'invalid') {
    console.log('exists / invalid : ', newStockData);
  } else {
    data = temp;
    drawChart(data);
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected');
  data = {};
});

socket.on('stockAll', allStockData => {
  console.log('stockAll');
  data = allStockData;
  drawChart(data);
});

const drawChart = (data) => {

  data.forEach(d => {
    d.ticker = d[0];
    d.closeDate = parseDate(d[1]);
    d.closeVal = +d[2];
  });

  // Scale the range of the data
  // x.domain(d3.extent(data, d => d.closeDate));
  x.domain([parseDate(lastYearDate), parseDate(todayDate)]);
  y.domain([0, d3.max(data, d => d.closeVal)]);

  // Nest the entries by symbol
  const nestedData = d3.nest()
    .key(d => d.ticker)
    .entries(data);

  // https://www.youtube.com/watch?v=OZXYk_bgQGQ

  /*
  Select all paths in chart
  If exists, use UPDATE selection to update their new priceLine
  If doesn't exist, use ENTER selection for new data to append their corresponding paths
  If exists and shouldn't (got deleted), use EXIT selection for stale delete to delete their paths

  Data in array gets bound by their element value as KEY. But for special items where you need a custom key, like some element inside an object in the array, use the (data,[key]) function while joining
  */

  // Select all paths to use them in ENTER / UPDATE / EXIT selections
  var path = chart.selectAll('path')
    .data(nestedData, d => d.key);

  // Delete removed tickers
  path.exit().remove();

  // Update value of path of existing data since scale will change when adding new tickers
  path.attr('d', d => priceLine(d.values));

  // Append path for newly added ticker
  path.enter()
    .append('path')
    .attr('stroke', d => colors(d.key))
    .attr('class', d => `line ${d.key}`)
    .attr('d', d => priceLine(d.values));

  console.log(nestedData)
}


/////////////////////////////////////////////////////////


