import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/latest/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

export const getPilotosDuration = new Trend('get_pilotos', true);
export const RateContentOK = new Rate('content_OK');

const baseUrl = 'https://f1-api-victorbrignoli.onrender.com';

export const options = {
  thresholds: {
    // menos de 25% das requisições retornam erro
    http_req_failed: ['rate<0.25'],
    // 90% das respostas com tempo abaixo de 6800ms
    get_pilotos: ['p(90)<6800']
  },
  // rampa: inicia com 7 VUs, máximo de 92 VUs, total de 3,5 minutos
  stages: [
    { duration: '30s', target: 7 },
    { duration: '60s', target: 50 },
    { duration: '60s', target: 92 },
    { duration: '60s', target: 92 }
  ]
};

// A API roda no plano free do Render, que hiberna sem uso e leva ~30-60s
// para acordar. O setup espera ela responder antes de iniciar a carga.
export function setup() {
  for (let tentativa = 1; tentativa <= 12; tentativa++) {
    const res = http.get(`${baseUrl}/`, { timeout: '90s' });
    if (res.status === 200) return;
    sleep(5);
  }
  throw new Error('F1 API não respondeu ao health check');
}

export function handleSummary(data) {
  return {
    './src/output/index.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  };
}

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const OK = 200;

  const res = http.get(`${baseUrl}/pilotos`, params);

  getPilotosDuration.add(res.timings.duration);

  RateContentOK.add(res.status === OK);

  check(res, {
    'GET Pilotos - Status 200': () => res.status === OK,
    'GET Pilotos - Has pilotos': () =>
      res.status === OK && res.json('pilotos').length > 0
  });

  sleep(1);
}
