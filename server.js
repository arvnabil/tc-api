require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const api = require("./trueconf-api");
const flash = require("connect-flash");
const multer = require("multer");
const exceljs = require("exceljs");
const path = require("path");
const session = require("express-session");

const app = express();
const port = 3000;

// Set up middleware
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // Sesi berlaku 24 jam
  })
);
app.use(flash());

// Konfigurasi Multer untuk menangani unggahan file di memori
const upload = multer({ storage: multer.memoryStorage() });

// Middleware untuk variabel global (pesan flash)
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error"); // Untuk kompatibilitas dengan halaman login
  res.locals.old_input = req.flash("old_input")[0] || {}; // Untuk mengisi kembali form
  res.locals.currentPath = req.path;
  next();
});

// Middleware untuk memeriksa apakah pengguna sudah login
const requireAuth = (req, res, next) => {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.redirect("/login");
  }
};

// Routes
app.get("/", requireAuth, async (req, res) => {
  const searchQuery = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = 10; // Jumlah pengguna per halaman

  let users = [];
  let totalPages = 0;
  let error = null;
  let search_success_msg = null;

  // Hanya jalankan pencarian jika ada query
  if (searchQuery) {
    try {
      const foundUsers = await api.getUsers(searchQuery);
      console.log("Hasil query API:", foundUsers); // Menampilkan hasil query di konsol
      totalPages = Math.ceil(foundUsers.length / limit);

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      users = foundUsers.slice(startIndex, endIndex);
      if (users.length > 0) {
        search_success_msg = `Pencarian untuk "${searchQuery}" berhasil ditemukan.`;
      }
    } catch (e) {
      console.error("Error fetching users:", e.message);
      error = "Gagal mengambil data pengguna. Silakan coba lagi.";
    }
  }

  // Tetapkan semua variabel ke res.locals agar tersedia di templat.
  // Pola ini konsisten dengan cara pesan flash diteruskan.
  res.locals.users = users;
  res.locals.searchQuery = searchQuery;
  res.locals.error = error; // Catatan: Ini menimpa pesan flash 'error' apa pun.
  res.locals.currentPage = page;
  res.locals.search_success_msg = search_success_msg;
  res.locals.totalPages = totalPages;

  // Tambahkan judul ke locals
  res.locals.title = "Dashboard";

  res.render("index");
});

app.get("/login", (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect("/");
  }
  // Kirim judul saat merender halaman login
  res.render("login", { title: "Login" });
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === process.env.APP_PASSWORD) {
    req.session.isAuthenticated = true;
    req.flash("success_msg", "Anda berhasil login.");
    res.redirect("/");
  } else {
    req.flash("error", "Password yang Anda masukkan salah.");
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/");
    }
    res.redirect("/login");
  });
});

app.get("/tambah", requireAuth, (req, res) => {
  // Variabel `error` dan `old_input` sudah tersedia di `res.locals` dari middleware
  res.render("tambah-user", { title: "Tambah Pengguna" });
});

app.post("/tambah", requireAuth, async (req, res) => {
  // Validasi input dasar di sisi server
  if (!req.body.id || !req.body.password) {
    req.flash("error", "User ID dan Password wajib diisi.");
    req.flash("old_input", req.body);
    return res.redirect("/tambah");
  }

  const userData = {
    id: req.body.id,
    login_name: req.body.id, // Menambahkan login_name, defaultnya sama dengan ID
    password: req.body.password,
    display_name: req.body.display_name || "", // Default ke string kosong
    first_name: req.body.first_name || "", // Default ke string kosong
    last_name: req.body.last_name || "", // Default ke string kosong
    company: req.body.company || "", // Default ke string kosong
    email: `${req.body.id}@mobilevicon.polri.go.id`, // Asumsi format email
    uid: `${req.body.id}@mobilevicon.polri.go.id`, // Asumsi format uid
    is_active: 1, // Default
    status: 0, // Default
    avatar: null, // Default
    groups: null, // Default
    mobile_phone: "", // Default
    work_phone: "", // Default
    home_phone: "", // Default
  };

  // Log payload sebelum dikirim ke API untuk debugging
  console.log("Payload to be sent to API:", userData);

  try {
    await api.addUser(userData);
    req.flash("success_msg", `Pengguna "${userData.id}" berhasil ditambahkan.`);
    res.redirect(`/?search=${encodeURIComponent(userData.id)}`);
  } catch (error) {
    console.error("Error adding user:", error.message);
    req.flash("error", `Gagal menambahkan pengguna: ${error.message}`);
    req.flash("old_input", req.body);
    res.redirect("/tambah");
  }
});

app.get("/api/users/search", requireAuth, async (req, res) => {
  const term = req.query.term || "";
  if (term.length < 2) {
    return res.json([]);
  }

  try {
    const users = await api.searchUsers(term);
    // Kirim hanya ID pengguna untuk ditampilkan di autocomplete
    const userIds = users.map((user) => user.id);
    res.json(userIds);
  } catch (error) {
    console.error("Autocomplete search error:", error);
    res.status(500).json([]);
  }
});

app.get("/import", requireAuth, (req, res) => {
  const usersToReview = req.session.importData || [];
  // Render halaman import dengan data (jika ada) dan tab aktif dari query URL
  res.render("import-user", {
    ...res.locals,
    usersToReview,
    activeTab: req.query.tab || "download",
    title: "Import Pengguna",
  });
});

app.get("/download-template", requireAuth, async (req, res) => {
  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet("Template");

  // Definisikan header kolom sesuai format yang dibutuhkan
  worksheet.columns = [
    { header: "id", key: "id", width: 25 },
    { header: "password", key: "password", width: 20 },
    { header: "display_name", key: "display_name", width: 30 },
    { header: "first_name", key: "first_name", width: 25 },
    { header: "last_name", key: "last_name", width: 25 },
    { header: "company", key: "company", width: 30 },
  ];

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "template-tambah-user.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

app.post(
  "/import/review",
  requireAuth,
  upload.single("userFile"),
  async (req, res) => {
    if (!req.file) {
      req.flash(
        "error_msg",
        "File tidak ditemukan. Silakan unggah file Excel."
      );
      return res.redirect("/import?tab=upload");
    }

    try {
      const workbook = new exceljs.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      const usersToReview = [];
      const expectedHeaders = [
        "id",
        "password",
        "display_name",
        "first_name",
        "last_name",
        "company",
      ];

      // Validasi header
      const headerRow = worksheet.getRow(1);
      const actualHeaders = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= expectedHeaders.length) actualHeaders.push(cell.value);
      });

      if (JSON.stringify(actualHeaders) !== JSON.stringify(expectedHeaders)) {
        req.flash(
          "error_msg",
          "Format header Excel tidak sesuai. Harap gunakan template yang disediakan."
        );
        return res.redirect("/import?tab=upload");
      }

      // Baca data dari baris kedua dan seterusnya
      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber);
        const id = String(row.getCell("A").value || "").trim();
        const password = String(row.getCell("B").value || "");

        // Lewati baris yang benar-benar kosong
        if (!id && !password && !String(row.getCell("C").value || "")) continue;

        if (!id || !password) {
          throw new Error(
            `Data tidak valid pada baris ${rowNumber}. Kolom 'id' dan 'password' wajib diisi.`
          );
        }

        usersToReview.push({
          id: id,
          password: password,
          display_name: String(row.getCell("C").value || ""),
          first_name: String(row.getCell("D").value || ""),
          last_name: String(row.getCell("E").value || ""),
          company: String(row.getCell("F").value || ""),
        });
      }

      req.session.importData = usersToReview;
      res.redirect("/import?tab=review");
    } catch (error) {
      console.error("Error processing excel file:", error);
      const errorMessage = error.message.includes("Data tidak valid")
        ? error.message
        : "Gagal memproses file Excel. Pastikan formatnya benar.";
      req.flash("error_msg", errorMessage);
      res.redirect("/import?tab=upload");
    }
  }
);

app.get("/import/process-stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const usersToProcess = req.session.importData;

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!usersToProcess || usersToProcess.length === 0) {
    sendEvent({ log: "Tidak ada data pengguna untuk diproses.", done: true });
    return res.end();
  }

  sendEvent({
    log: `Memulai proses penambahan ${usersToProcess.length} user...`,
  });

  for (const user of usersToProcess) {
    sendEvent({ log: `-------------------------------------------` });
    sendEvent({ log: `Mencoba menambahkan user: ${user.id}` });

    const userData = {
      id: user.id,
      login_name: user.id,
      password: user.password,
      display_name: user.display_name || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      company: user.company || "",
      email: `${user.id}@mobilevicon.polri.go.id`,
      uid: `${user.id}@mobilevicon.polri.go.id`,
      is_active: 1,
      status: 0,
      avatar: null,
      groups: null,
      mobile_phone: "",
      work_phone: "",
      home_phone: "",
    };

    try {
      const result = await api.addUser(userData);
      if (result && result.user && result.user.id) {
        sendEvent({
          log: `✅ BERHASIL: User "${result.user.id}" berhasil diproses.`,
        });
      } else {
        sendEvent({
          log: `✅ BERHASIL: User "${user.id}" diproses, namun respons tidak terduga.`,
        });
      }
    } catch (error) {
      sendEvent({
        log: `❌ GAGAL: User "${user.id}" gagal dibuat. Alasan: ${error.message}`,
      });
    }
  }

  sendEvent({ log: `-------------------------------------------` });
  sendEvent({ log: "🎉 Proses Selesai!" });
  sendEvent({ done: true });

  delete req.session.importData;
  res.end();
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
