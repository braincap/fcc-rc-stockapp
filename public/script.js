'use strict';
var socket = io.connect({ 'forceNew': true });

$('form').submit(function (e) {
  e.preventDefault();
  socket.emit('stock', $('.input-field').val());
  return false;
});


var data = {};
var margin = { top: 50, right: 100, bottom: 50, left: 100 };

var transitionDuration = 1000;
const todayDate = moment().format('YYYY-MM-DD');
const lastYearDate = moment(todayDate).subtract(1, 'year').add(1, 'day').format('YYYY-MM-DD');
const lastQuarterDate = moment(todayDate).subtract(3, 'month').add(1, 'day').format('YYYY-MM-DD');
const lastMonthDate = moment(todayDate).subtract(1, 'month').add(1, 'day').format('YYYY-MM-DD');

var width = 800 - margin.left - margin.right;
var height = 600 - margin.top - margin.bottom;

// Set the ranges
var x = d3.scaleTime().range([0, width]);
var y = d3.scaleLinear().range([height, 0]);
var colors = d3.scaleOrdinal(d3.schemeCategory10);

// Data formatting
var parseDate = d3.timeParse('%Y-%m-%d');

var chart = d3.select('.chart')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('class', 'main')
  .attr('transform', `translate(${margin.left},${margin.top})`);

socket.on('stockNew', newStockData => {
  if (newStockData === 'exists' || newStockData === 'invalid') {
    console.log('exists / invalid : ', newStockData);
    $('.input-field').val('');
    $('.input-field').attr('placeholder', (newStockData === 'exists') ? 'Enter new symbol' : 'Enter valid symbol');
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

  // Default to only 1 year data
  var tempData = data.filter(d => parseDate(d[1]) > parseDate(lastMonthDate));
  data = tempData;

  data.forEach(d => {
    d.ticker = d[0];
    d.closeDate = parseDate(d[1]);
    d.closeVal = +d[2];
  });

  // Scale the range of the data
  // x.domain(d3.extent(data, d => d.closeDate));
  x.domain([parseDate(lastMonthDate), parseDate(todayDate)]);
  y.domain([0, d3.max(data, d => d.closeVal)]);
  console.log(x.domain(), y.domain());

  // Define the line
  var priceLine = d3.line()
    .x(d => x(d.closeDate))
    .y(d => y(d.closeVal));


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

  // Append path for newly added ticker
  path.enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', d => colors(d.key))
    .attr('class', d => `line ${d.key}`)
    .attr('d', d => priceLine(d.values))
    .attr('stroke-dasharray', function (d) { return this.getTotalLength() })
    .attr('stroke-dashoffset', function (d) { return this.getTotalLength() })
    .transition().duration(transitionDuration).ease(d3.easeQuadOut).attr('stroke-dashoffset', 0);

  drawTiles(path.enter().data().map(d => d.key));

  // Update value of path of existing data since scale will change when adding new tickers
  path
    // .transition()
    // .duration(transitionDuration)
    // .ease(d3.easeQuadOut)
    .attr('d', d => {
      console.log(d);
      return priceLine(d.values)
    });

  // Delete removed tickers
  path
    .exit()
    .transition()
    .duration(transitionDuration)
    .ease(d3.easeQuadOut)
    .style('opacity', 0)
    .remove();

  removeTiles(path.exit().data().map(d => d.key));


  var xAxis = d3.axisBottom(x);

  var yAxis = d3.axisRight(y)
    .tickSize(width);

  if (!d3.selectAll('.axis').size()) {

    var xGroup = chart.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0, ${height}) `)
      .call(customXAxis);

    var yGroup = chart.append('g')
      .attr('class', 'y axis')
      .call(customYAxis);

  } else {
    d3.selectAll('.y.axis')
      .transition()
      .duration(transitionDuration)
      .call(customYAxis);
  }

  function customXAxis(g) {
    g.call(xAxis);
    g.select('.domain').remove();
  }


  // MOUSE HOVER TOOLTIP (LATER) from (https://stackoverflow.com/questions/34886070/multiseries-line-chart-with-mouseover-tooltip)

  // NEEDS CLARIFICATION?
  function customYAxis(g) {
    var s = g.selection ? g.selection() : g;
    g.call(yAxis);
    s.select('.domain').remove();
    s.selectAll('.tick:not(:first-of-type) line').attr('stroke', 'whitesmoke').attr('stroke-dasharray', '2,2');
    s.selectAll('.tick text').attr('x', 4).attr('dy', -4).attr('fill', 'whitesmoke');
    if (s !== g) {
      g.selectAll('.tick text').attrTween('x', null).attrTween('dy', null);
    }
  }

}

function drawTiles(tickers) {
  tickers.forEach(ticker => {
    $(`<div class='ticker-card ${ticker}' data-tilt> <div>${ticker}</div></div > `)
      .appendTo('.ticker-div')
      .css({ 'opacity': 0 })
      .animate({ 'opacity': 1 }, 2000)
      .on('click', function () {
        socket.emit('stockDel', ticker);
      })
      .tilt();
  });
}

function removeTiles(tickers) {
  tickers.forEach(ticker => {
    $(`.ticker-card.${ticker}`).remove();
  });
}

$('body').on('mouseenter', '.ticker-card', function () {
  $(`.line.${$(this).attr('class').split(' ')[1]
    }`).css('stroke-width', 4);
});

$('body').on('mouseleave', '.ticker-card', function () {
  $(`.line.${$(this).attr('class').split(' ')[1]
    }`).css('stroke-width', 2);
});
