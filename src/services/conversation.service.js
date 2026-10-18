const conversations = new Map();

// Menyimpan konteks percakapan berdasarkan nomor WhatsApp.
const setContext = (phone, context) => {
    conversations.set(phone, {
        ...context,
        updatedAt: new Date()
    });
};

// Mengambil konteks milik nomor WhatsApp tertentu.
const getContext = (phone) => {
    return conversations.get(phone) || null;
};

// Menghapus konteks percakapan.
const clearContext = (phone) => {
    conversations.delete(phone);
};

module.exports = {
    setContext,
    getContext,
    clearContext
};