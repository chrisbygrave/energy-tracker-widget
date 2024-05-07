// Scriptable Widget for Displaying Energy and Gas Tariff Information
// Adapted from https://github.com/smalley1992/smalley1992.github.io/blob/main/OctopusTrackerSmallWidget.scriptable

// Constants for configuration
const BASE_URL = 'https://api.octopus.energy/v1/products/';
const WHITE_COLOR = new Color('#ffffff');
const ERROR_COLOR = new Color('#FF3B30');
const SUCCESS_COLOR = new Color('#30D158');

// Helper function to create and format text
function createText(widget, content, fontSize, color, fontWeight = 'bold') {
  let text = widget.addText(content);
  text.font =
    fontWeight === 'bold'
      ? Font.boldSystemFont(fontSize)
      : Font.systemFont(fontSize);
  text.textColor = color;
  return text;
}

// Function to adjust the current time to the closest previous half-hour mark
function getAdjustedTimes() {
  const now = new Date();
  const localTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/London' })
  );
  localTime.setSeconds(0, 0); // Reset seconds and milliseconds
  const minutes = localTime.getMinutes();
  localTime.setMinutes(minutes >= 30 ? 30 : 0);
  let periodStart = new Date(localTime);
  let periodEnd = new Date(localTime.getTime() + 48 * 30 * 60000); // next 4 30 minute slots
  return { periodStart, periodEnd };
}

// Function to build URL for API request
function buildUrl(productCode, tariffCode, periodStart, periodEnd, tariffType) {
  let dateStr = periodStart.toISOString();
  let periodStr = `${dateStr}&period_to=${periodEnd.toISOString()}`;
  return `${BASE_URL}${productCode}/${tariffType}-tariffs/${tariffCode}/standard-unit-rates/?period_from=${periodStr}`;
}

// Function to fetch tariff data
// Fetches tariff data for now and the next few periods
async function fetchTariffData(productCode, tariffCode, tariffType) {
  const dateFormatter = new DateFormatter();
  dateFormatter.dateFormat = 'H:mm';
  const { periodStart, periodEnd } = getAdjustedTimes();
  const periodStartTomorrow = new Date(periodStart.getTime() + 86400000);
  const periodEndTomorrow = new Date(periodEnd.getTime() + 86400000);

  let urlToday = buildUrl(
    productCode,
    tariffCode,
    periodStart,
    periodEnd,
    tariffType
  );

  try {
    const responseToday = await new Request(urlToday).loadJSON();
    const prices = responseToday.results
      .map((result) => ({
        price: result.value_inc_vat.toFixed(2) || 'N/A',
        time: dateFormatter.string(new Date(result.valid_from)),
      }))
      .reverse();
    return { now: prices[0], next: prices.slice(1) };
  } catch (error) {
    console.error(`Error fetching data: ${error}`);
    return { now: {price: 'N/A', time: 'N/A'}, next: [] };
  }
}

async function fetchTariffGraph(tariffData) {
  labels = [`'${encodeURIComponent(tariffData.now.time)}'`];
  data = [`'${tariffData.now.price}'`];
  tariffData.next.forEach((item) => {
    labels.push(`'${encodeURIComponent(item.time)}'`);
    data.push(`'${item.price}'`);
  });
  labelsString = labels.join(',');
  dataString = data.join(',');
  const graphUrl = `https://quickchart.io/chart?c={type:'line',options:{legend:{display:false},scales:{xAxes:[{display:false}]}},data:{labels:[${labelsString}],datasets:[{label:'Prices',data:[${dataString}]}]}}`;
  console.log(graphUrl);
  return await new Request(graphUrl).loadImage();
}

// Function to display tariff data including tomorrow's forecast
async function displayTariffData(productCode, tariffCode, symbolName, widget) {
  const tariffType = tariffCode.charAt(0) === 'G' ? 'gas' : 'electricity';
  const data = await fetchTariffData(productCode, tariffCode, tariffType);

  const parent = widget.addStack();
  const graphImg = parent.addImage(await fetchTariffGraph(data));
  deviceScreen = Device.screenSize();
  let widgetSize = new Size(deviceScreen.width - 100, 160);
  graphImg.imageSize = widgetSize;
}

// Initialize widget and set properties
const widget = new ListWidget();
widget.backgroundColor = new Color('#100030');
const regionCode = 'L';
const electricityProductCode = 'AGILE-23-12-06';
const electricityTariffCode = `E-1R-AGILE-23-12-06-${regionCode}`;
await displayTariffData(
  electricityProductCode,
  electricityTariffCode,
  'bolt.fill',
  widget
);
if (!config.runsInWidget) {
  await widget.presentMedium();
}
Script.setWidget(widget);
Script.complete();
