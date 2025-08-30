const axios = require("axios");

const SERVER_ADDRESS = process.env.SERVER_ADDRESS;
const API_KEY = process.env.API_KEY;
const API_URL_USERS = `${SERVER_ADDRESS}/api/v3/users`;

/**
 * Mengambil daftar pengguna dari TrueConf Server.
 * @param {string} searchQuery - String untuk mencari pengguna berdasarkan ID.
 * @returns {Promise<Array>} - Array of user objects.
 */
async function getUsers(searchQuery = "") {
  // Jika tidak ada query pencarian, kembalikan array kosong.
  // Halaman utama akan menampilkan pesan awal.
  if (!searchQuery) {
    return [];
  }

  try {
    // API TrueConf mendukung pengambilan pengguna berdasarkan ID melalui /api/v3/users/{user_id}
    const response = await axios.get(`${API_URL_USERS}/${searchQuery}`, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
    });

    // API mengembalikan satu objek pengguna jika ditemukan.
    // Kita perlu mengembalikannya sebagai array agar sesuai dengan struktur data sebelumnya.
    return [response.data];
  } catch (error) {
    // Jika error adalah 404, berarti pengguna tidak ditemukan.
    // Ini bukan kesalahan server, jadi kita kembalikan array kosong.
    if (error.response && error.response.status === 404) {
      console.log(`Pengguna dengan ID "${searchQuery}" tidak ditemukan.`);
      return [];
    }

    // Untuk error lainnya, catat dan lempar kembali.
    console.error(
      "API Error (getUsers):",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    if (error.response && error.response.data) {
      const apiMessage =
        error.response.data.error?.message || error.response.data.message;
      if (apiMessage) {
        throw new Error(apiMessage);
      }
    }
    throw new Error(error.message || "Koneksi ke server API gagal");
  }
}

/**
 * Menambahkan pengguna baru ke TrueConf Server.
 * @param {object} userData - Objek data pengguna.
 * @returns {Promise<object>} - Objek respons dari API.
 */
async function addUser(userData) {
  try {
    const response = await axios.post(API_URL_USERS, userData, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
    });
    console.log(`User "${userData.id}" added successfully.`, response.data);
    return response.data;
  } catch (error) {
    console.error(
      "API Error (addUser):",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    // Prioritaskan pesan error dari body respons API untuk pesan yang lebih jelas.
    if (error.response && error.response.data) {
      // API mungkin mengembalikan format { error: { message: '...' } } atau { message: '...' }
      const apiMessage =
        error.response.data.error?.message || error.response.data.message;
      if (apiMessage) {
        throw new Error(apiMessage);
      }
    }
    // Jika tidak ada pesan spesifik dari API, gunakan pesan error dari Axios.
    throw new Error(error.message);
  }
}

/**
 * Menambahkan beberapa pengguna baru sekaligus (bulk) ke TrueConf Server.
 * @param {Array<object>} usersData - Array dari objek data pengguna.
 * @returns {Promise<object>} - Objek respons dari API.
 */
async function addUsersBulk(usersData) {
  try {
    // Payload kemungkinan besar adalah array pengguna secara langsung, bukan objek.
    const payload = usersData;
    const response = await axios.post(API_URL_USERS, payload, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
    });
    console.log(
      `${usersData.length} users processed successfully.`,
      response.data
    );
    return response.data;
  } catch (error) {
    console.error(
      "API Error (addUsersBulk):",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    if (error.response && error.response.data) {
      const apiMessage =
        error.response.data.error?.message || error.response.data.message;
      if (apiMessage) {
        throw new Error(apiMessage);
      }
    }
    throw new Error(error.message);
  }
}

/**
 * Mencari daftar pengguna berdasarkan sebagian ID atau nama.
 * @param {string} term - String untuk mencari pengguna.
 * @returns {Promise<Array>} - Array of user objects.
 */
async function searchUsers(term) {
  if (!term) {
    return [];
  }
  try {
    // API TrueConf mendukung pencarian dengan parameter `search`
    const response = await axios.get(API_URL_USERS, {
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
      },
      params: {
        search: term,
        limit: 10, // Batasi hasil untuk autocomplete
      },
    });
    // API mengembalikan objek dengan properti 'users'
    return response.data.users || [];
  } catch (error) {
    console.error(
      "API Error (searchUsers):",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    // Jangan lemparkan error, kembalikan array kosong agar UI tidak rusak
    return [];
  }
}

module.exports = {
  getUsers,
  addUser,
  addUsersBulk,
  searchUsers,
};
