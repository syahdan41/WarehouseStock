const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const db = require("./connection");
const response = require("./response");
const cors = require("cors");
const jwt = require("jsonwebtoken");

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World! ini bacen yang baru nyoba nodemon");
});

app.post("/api/register", (req, res) => {
  const { username, firstname, lastname, roles, password } = req.body;

  db.query("SELECT * from user_detail WHERE username=?", [username], (err, results) => {
    if (err) {
      console.log("MySQL error", err);
      response(500, results, "Internal Server Error", res);
    }
    if (results.length > 0) {
      response(400, results, "Username Already Exist", res);
    }
    db.query("INSERT INTO user_detail (username, firstname, lastname, roles, password) VALUES(?,?,?,?,?)", [username, firstname, lastname, roles, password], (err) => {
      if (err) {
        console.error("MySQL error:", err);
        response(500, results, "Internal Server Error", res);
      }
      response(200, results, "User Registered Succesfully", res);
    });
  });
});

// Endpoint untuk login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM user_detail WHERE username = ? AND password = ?";
  db.query(query, [username, password], (error, results) => {
    if (error) {
      console.error("MySQL error:", error);
      response(500, null, "Internal Server Error", res);
    } else if (results.length > 0) {
      const user = results[0];
      const userId = user.id; // Assuming user_id is the column name in your user_detail table

      response(200, { user: { userId, firstname: user.firstname, lastname: user.lastname } }, "Login successful", res);
    } else {
      response(401, null, "Invalid username or password", res);
    }
  });
});
app.get("/api/user-detail", (req, res) => {
  const userId = req.query.id;

  if (!userId) {
    response(400, null, "Bad Request: User ID is missing", res);
    return;
  }

  const query = `SELECT * FROM user_detail WHERE id = ${userId}`;
  db.query(query, (error, results) => {
    if (error) {
      console.error("MySQL error:", error);
      response(500, null, `Internal Server Error: ${error.message}`, res);
    } else if (results.length > 0) {
      const userDetail = results[0];
      response(200, { userDetail }, "User detail retrieved successfully", res);
    } else {
      response(404, null, "User detail not found", res);
    }
  });
});
const checkIfExistingInDatabase = async (kode_material, nama_material) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM stock_detail WHERE kode_material = ? OR nama_material = ?";
    db.query(query, [kode_material, nama_material], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

const updateStockInDatabase = async (kode_material, stock_material, status_material, last_updated) => {
  return new Promise((resolve, reject) => {
    const query = "UPDATE stock_detail SET stock_material = stock_material + ?, status_material = CASE WHEN stock_material = 0 THEN 'empty' ELSE ? END, last_updated = ? WHERE kode_material = ?";
    db.query(query, [stock_material, status_material, last_updated, kode_material], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

const insertStockToDatabase = async (kode_material, nama_material, varian_material, stock_material, status_material, last_updated) => {
  return new Promise((resolve, reject) => {
    const query = "INSERT INTO stock_detail (kode_material, nama_material, varian_material, stock_material, status_material, last_updated) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(query, [kode_material, nama_material, varian_material, stock_material, status_material, last_updated], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

app.post("/api/incoming-stock", async (req, res) => {
  const { kode_material, nama_material, varian_material, stock_material, status_material, last_updated } = req.body;
  try {
    const existingItem = await checkIfExistingInDatabase(kode_material, nama_material);

    if (existingItem.length > 0) {
      // Data sudah ada, lakukan update
      await updateStockInDatabase(kode_material, stock_material, status_material, last_updated, varian_material);

      // Ambil data yang sudah di-update
      const updatedItem = await checkIfExistingInDatabase(kode_material, nama_material);
      return response(200, updatedItem, "Stock Berhasil Di-update", res);
    } else {
      // Data belum ada, lakukan insert
      await insertStockToDatabase(kode_material, nama_material, varian_material, stock_material, status_material, last_updated);

      // Ambil data yang baru di-insert
      const newItem = await checkIfExistingInDatabase(kode_material, nama_material);
      return response(201, newItem, "Stock Berhasil Dibuat", res);
    }
  } catch (error) {
    console.error("Error: ", error);
    return response(500, null, "Internal Server Error", res);
  }
});

// setting API INCOMING STOCK DETAILS
const checkIfExistingInDatabaseIncomingStock = async (kode_material, nama_material) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM incoming_materials WHERE kode_material = ? OR nama_material = ?";
    db.query(query, [kode_material, nama_material], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

const insertStockToDatabaseIncomingStock = async (kode_material, nama_material, varian_material, jumlah_material_masuk, waktu_material_masuk) => {
  return new Promise((resolve, reject) => {
    const query = "INSERT INTO incoming_materials (kode_material, nama_material, varian_material, jumlah_material_masuk,waktu_material_masuk) VALUES (?, ?, ?, ?, ?)";
    db.query(query, [kode_material, nama_material, varian_material, jumlah_material_masuk, waktu_material_masuk], (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};
app.post("/api/incoming-stock-details", (req, res) => {
  const { nama_material, kode_material, jumlah_material_masuk, varian_material, waktu_material_masuk } = req.body;

  // Validasi data yang diterima dari request
  if (!nama_material || !kode_material || !jumlah_material_masuk || !varian_material || !waktu_material_masuk) {
    response(400, null, "Harap isi semua field!", res);
    return;
  }

  // Query untuk menambahkan data ke tabel incoming_stock_details
  const insertQuery = `INSERT INTO incoming_materials (nama_material, kode_material, jumlah_material_masuk, varian_material, waktu_material_masuk)
                       VALUES (?, ?, ?, ?, ?)`;

  // Eksekusi query
  db.query(insertQuery, [nama_material, kode_material, jumlah_material_masuk, varian_material, waktu_material_masuk], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      response(201, { id: results.insertId }, "Data berhasil ditambahkan", res);
    }
  });
});

// setting outcoming stock

app.post("/api/outcoming-stock", (req, res) => {
  const { kode_material, nama_material, jumlahRequest } = req.body;

  const checkStockQuery = "SELECT stock_material FROM stock_detail WHERE kode_material = ? AND nama_material = ?";

  db.query(checkStockQuery, [kode_material, nama_material], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      if (results.length === 0) {
        response(404, null, "Data not found", res);
      } else {
        const currentStock = results[0].stock_material;
        if (currentStock >= jumlahRequest) {
          const updateStockQuery = "UPDATE stock_detail SET stock_material = ? WHERE kode_material = ? AND nama_material = ?";
          const newStock = currentStock - jumlahRequest;
          db.query(updateStockQuery, [newStock, kode_material, nama_material], (err, result) => {
            if (err) {
              response(500, null, "Internal Server Error", res);
            } else {
              response(200, { newStock }, "Stock updated successfully", res);
            }
          });
        } else {
          response(400, null, "Insufficient stock", res);
        }
      }
    }
  });
});

// setting API OUTCOMING STOCK DETAILS
app.post("/api/outcoming-stock-details", (req, res) => {
  const { nama_material, kode_material, jumlah_material_keluar, varian_material, waktu_material_keluar } = req.body;

  // Validasi data yang diterima dari request
  if (!nama_material || !kode_material || !jumlah_material_keluar || !varian_material || !waktu_material_keluar) {
    response(400, null, "Harap isi semua field!", res);
    return;
  }

  // Query untuk menambahkan data ke tabel incoming_stock_details
  const insertQuery = `INSERT INTO outcoming_materials (nama_material, kode_material, jumlah_material_keluar, varian_material, waktu_material_keluar)
                       VALUES (?, ?, ?, ?, ?)`;

  // Eksekusi query
  db.query(insertQuery, [nama_material, kode_material, jumlah_material_keluar, varian_material, waktu_material_keluar], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      response(201, { id: results.insertId }, "Data berhasil ditambahkan", res);
    }
  });
});

// get data outcoming details
app.get("/api/get-outcoming-stock", (req, res) => {
  const selectQuery = "SELECT * FROM outcoming_materials";

  db.query(selectQuery, [], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      response(200, results, "Data berhasil diambil", res);
    }
  });
});
// get incoming stock details
app.get("/api/get-incoming-stock", (req, res) => {
  const selectQuery = "SELECT * FROM incoming_materials";

  db.query(selectQuery, [], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      response(200, results, "Data berhasil diambil", res);
    }
  });
});

app.get("/api/get-stock-detail", (req, res) => {
  const selectQuery = "SELECT * FROM stock_detail";

  db.query(selectQuery, [], (error, results) => {
    if (error) {
      response(500, null, "Internal Server Error", res);
    } else {
      response(200, results, "Data berhasil diambil", res);
    }
  });
});

app.delete("/api/delete-stock-detail/:itemId", (req, res) => {
  const itemId = req.params.itemId;

  const deleteQuery = "DELETE FROM stock_detail WHERE id = ?";

  db.query(deleteQuery, [itemId], (err, result) => {
    if (err) {
      console.error("Error deleting item from database:", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.status(200).json({ message: "Item deleted successfully" });
    }
  });
});

app.delete("/api/delete-incoming/:itemId", (req, res) => {
  const itemId = req.params.itemId;

  const deleteQuery = "DELETE FROM incoming_materials WHERE id = ?";

  db.query(deleteQuery, [itemId], (err, result) => {
    if (err) {
      console.error("Error deleting item from database:", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.status(200).json({ message: "Item deleted successfully" });
    }
  });
});

app.delete("/api/delete-outcoming/:itemId", (req, res) => {
  const itemId = req.params.itemId;

  const deleteQuery = "DELETE FROM outcoming_materials WHERE id = ?";

  db.query(deleteQuery, [itemId], (err, result) => {
    if (err) {
      console.error("Error deleting item from database:", err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.status(200).json({ message: "Item deleted successfully" });
    }
  });
});

const port = 3002;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
