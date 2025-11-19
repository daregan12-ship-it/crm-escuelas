// Custom ambient module declarations to satisfy TypeScript when external types are missing
declare module 'chart.js/auto' {
  import Chart from 'chart.js';
  export default Chart;
}

declare module 'chart.js' {
  const Chart: any;
  export default Chart;
}
