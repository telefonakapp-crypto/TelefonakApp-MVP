'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { deliverSms, toProviderMno, otpSmsText } = require('./smsProvider');

const config = {
  apiUrl: 'https://sms.thecaptainjo.com:8445/websmpp/websms',
  username: 'Telefonak',
  password: 'test-sms-password-not-real',
  senderId: 'Telefonak',
  type: '3',
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe('SMS provider phone conversion', () => {
  it('converts canonical 07XXXXXXXX to 9627XXXXXXXX', () => {
    assert.equal(toProviderMno('0791234567'), '962791234567');
    assert.equal(toProviderMno('0793400033'), '962793400033');
  });

  it('keeps the OTP message wording', () => {
    assert.equal(otpSmsText('4321'), 'Your Telefonak verification code is: 4321');
  });
});

describe('SMS provider response handling', () => {
  it('accepts a numeric provider message reference', async () => {
    let seen = null;
    await deliverSms(config, { phoneNumber: '0791234567', text: otpSmsText('4321') }, async (url) => {
      seen = new URL(url);
      return jsonResponse(200, { Response: ['2609291933272148191'] });
    });
    assert.equal(seen.origin + seen.pathname, config.apiUrl);
    assert.equal(seen.searchParams.get('user'), 'Telefonak');
    assert.equal(seen.searchParams.get('sid'), 'Telefonak');
    assert.equal(seen.searchParams.get('mno'), '962791234567');
    assert.equal(seen.searchParams.get('type'), '3');
    assert.equal(seen.searchParams.get('text'), 'Your Telefonak verification code is: 4321');
    assert.equal(seen.searchParams.get('respformat'), 'json');
    assert.equal(seen.searchParams.get('pass') === config.password, true);
  });

  it('fails on a provider authorization error without exposing it', async () => {
    const providerError = 'ERROR - HTTP15 --> Not Authorized for the request.';
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0793400033', text: otpSmsText('4321') }, async () => jsonResponse(200, { Response: [providerError] })),
      (error) => {
        assert.equal(error.message, 'SMS delivery failed');
        assert.equal(error.message.includes('HTTP15'), false);
        assert.equal(error.message.includes(providerError), false);
        return true;
      }
    );
  });

  it('fails on a generic provider error string', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => jsonResponse(200, { Response: ['ERROR gateway rejected the submit'] })),
      (error) => {
        assert.equal(error.message, 'SMS delivery failed');
        assert.equal(error.message.includes('ERROR'), false);
        return true;
      }
    );
  });

  it('fails when Response contains only a blank entry', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => jsonResponse(200, { Response: [''] })),
      /SMS delivery failed/
    );
  });

  it('fails on HTTP error', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => jsonResponse(500, { Response: ['1'] })),
      /SMS delivery failed/
    );
  });

  it('fails on malformed JSON', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => ({
        ok: true,
        json: async () => {
          throw new Error('bad json');
        },
      })),
      /SMS delivery failed/
    );
  });

  it('fails when Response is missing', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => jsonResponse(200, {})),
      /SMS delivery failed/
    );
  });

  it('fails when Response is empty', async () => {
    await assert.rejects(
      () => deliverSms(config, { phoneNumber: '0791234567', text: 'x' }, async () => jsonResponse(200, { Response: [] })),
      /SMS delivery failed/
    );
  });
});
