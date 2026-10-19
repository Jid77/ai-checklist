let lastStatus = 'Belum ada request AI';
let lastError = null;
let totalTokens = 0;

const recordSuccess = (tokens = 0) => {
    lastStatus = 'Normal';
    lastError = null;
    totalTokens += Number(tokens) || 0;
};

const recordError = (error) => {
    lastStatus = 'Bermasalah';
    lastError = error.message || String(error);
};

const getStatus = () => {
    return [
        '🤖 Status AI',
        '',
        'Provider: OpenRouter',
        `Status: ${lastStatus === 'Normal' ? '🟢 Normal' : lastStatus === 'Bermasalah' ? '🔴 Bermasalah' : '⚪ Belum digunakan'}`,
        `Total token: ${totalTokens.toLocaleString('id-ID')}`,
        `Error terakhir: ${lastError || 'Tidak ada'}`
    ].join('\n');
};

module.exports = { recordSuccess, recordError, getStatus };