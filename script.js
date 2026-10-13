/* =========================================================
   StudyFlow — Smart Student Planner
   Logika aplikasi: Vanilla JavaScript (tanpa framework)
   Struktur file:
   1. Konstanta & state
   2. Fungsi bantu (DOM, tanggal, format)
   3. Lapisan penyimpanan (localStorage)
   4. Lapisan data tugas (CRUD)
   5. Perhitungan statistik, deadline, prioritas
   6. Filter, pencarian, pengurutan
   7. Render UI (dashboard, tugas, statistik, pomodoro, pengaturan)
   8. Event handler & inisialisasi
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     1. KONSTANTA & STATE
     ========================================================= */

  const KUNCI_TUGAS = 'studyflow.tugas.v1';       // kunci localStorage daftar tugas
  const KUNCI_PREF = 'studyflow.pengaturan.v1';   // kunci localStorage preferensi
  const VERSI_APP = 'Prototype v1.0';

  // Daftar mata kuliah contoh (dipakai di modal & data demo)
  const MATA_KULIAH = [
    'Dasar Pemrograman',
    'PTIK',
    'Logika dan Algoritma',
    'Pendidikan Pancasila',
    'Bahasa Inggris'
  ];

  const LABEL_STATUS = {
    belum: 'Belum Dikerjakan',
    sedang: 'Sedang Dikerjakan',
    selesai: 'Selesai'
  };

  const LABEL_PRIORITAS = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' };
  const BOBOT_PRIORITAS = { rendah: 1, sedang: 2, tinggi: 3 };

  const MOTIVASI = [
    'Konsistensi mengalahkan intensitas.',
    'Satu tugas selesai hari ini, satu beban kurang besok.',
    'Mulai dari yang paling kecil — momentum akan mengikuti.',
    'Fokus pada proses, hasilnya akan menyusul.',
    'Deadline bukan musuh, asal kamu yang memegang kendali.'
  ];

  // State aplikasi (sumber kebenaran tunggal untuk render)
  const state = {
    tasks: [],        // daftar tugas
    query: '',        // kata kunci pencarian
    filter: 'semua',  // filter status
    priority: 'semua',// filter prioritas
    sort: 'deadline',// mode pengurutan
    page: 'dashboard',// halaman aktif
    demoAktif: false, // apakah masih memakai data demo
    prefs: {
      nama: '',
      fokusMenit: 25,
      istirahatMenit: 5,
      sesiFokus: 0
    }
  };

  /* =========================================================
     2. FUNGSI BANTU
     ========================================================= */

  // Ambil elemen dengan cepat
  function $(id) { return document.getElementById(id); }

  // Membuat elemen SVG dari string ikon statis (aman: bukan input pengguna)
  function elemenIkon(namaIkon) {
    const template = document.createElement('template');
    template.innerHTML = (IKON[namaIkon] || '').trim();
    const el = template.content.firstElementChild;
    return el || document.createElement('span');
  }

  function buatElemen(tag, kelas, teks) {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks !== undefined && teks !== null) el.textContent = teks;
    return el;
  }

  function buatSVG(tag, atribut) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (atribut) {
      for (const kunci in atribut) {
        if (Object.prototype.hasOwnProperty.call(atribut, kunci)) {
          el.setAttribute(kunci, String(atribut[kunci]));
        }
      }
    }
    return el;
  }

  // ID unik sederhana (tidak bergantung pada library)
  function buatId() {
    return 'tugas-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // Tanggal hari ini (jam 00:00 waktu lokal)
  function hariIni() {
    const sekarang = new Date();
    return new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  }

  // Ubah Date menjadi string 'YYYY-MM-DD' sesuai waktu lokal
  function keISO(tanggal) {
    const y = tanggal.getFullYear();
    const m = String(tanggal.getMonth() + 1).padStart(2, '0');
    const d = String(tanggal.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function isoHariIni() { return keISO(hariIni()); }

  // Ubah 'YYYY-MM-DD' menjadi Date lokal (aman dari masalah zona waktu UTC)
  function dariISO(iso) {
    const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!cocok) return null;
    const tanggal = new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
    return isNaN(tanggal.getTime()) ? null : tanggal;
  }

  // Waktu lokal sekarang dalam format 'YYYY-MM-DDTHH:mm:ss'
  function stempelWaktuLokal() {
    const d = new Date();
    const jam = String(d.getHours()).padStart(2, '0');
    const menit = String(d.getMinutes()).padStart(2, '0');
    const detik = String(d.getSeconds()).padStart(2, '0');
    return keISO(d) + 'T' + jam + ':' + menit + ':' + detik;
  }

  // Selisih hari antara deadline dan hari ini (negatif = sudah lewat)
  function selisihHari(iso) {
    const target = dariISO(iso);
    if (!target) return null;
    const beda = target.getTime() - hariIni().getTime();
    return Math.round(beda / 86400000); // Math.round aman untuk perbedaan DST
  }

  function tanggalIndo(iso, panjang) {
    const tanggal = dariISO(iso);
    if (!tanggal) return '-';
    return tanggal.toLocaleDateString('id-ID', {
      weekday: panjang ? 'long' : 'short',
      day: 'numeric',
      month: panjang ? 'long' : 'short',
      year: 'numeric'
    });
  }

  function tanggalHariIniIndo() {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'long'
    });
  }

  /* =========================================================
     IKON SVG STATIS
     ========================================================= */

  const IKON = {
    cek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    pensil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    hapus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    kalender: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    bendera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4h11l-1.5 4L15 12H4"/></svg>',
    alarm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 3 5M19 3l2 2"/></svg>',
    centang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    peringatan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    buku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    piala: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H5a3 3 0 0 0 3 3M17 6h2a3 3 0 0 1-3 3"/></svg>',
    roket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M14.5 3.5C18 5 21 8 21 13c0 1.5-1 3-2.5 3.5L13 15l-4-4-1.5-5.5C8.5 4 10 3 11.5 3c1 0 2 .2 3 .5z"/><circle cx="14.5" cy="9.5" r="1.6"/></svg>',
    jam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/></svg>',
    kotak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>'
  };

  /* =========================================================
     3. LAPISAN PENYIMPANAN (localStorage)
     ========================================================= */

  // Membaca localStorage dengan penanganan error (data rusak / diblokir)
  function bacaPenyimpanan(kunci) {
    try {
      const mentah = window.localStorage.getItem(kunci);
      if (mentah === null) return { ada: false, nilai: null };
      return { ada: true, nilai: JSON.parse(mentah) };
    } catch (galat) {
      console.warn('Gagal membaca localStorage (' + kunci + '):', galat);
      return { ada: false, nilai: null, rusak: true };
    }
  }

  // Menyimpan ke localStorage dengan penanganan error (kuota penuh / private mode)
  function tulisPenyimpanan(kunci, nilai) {
    try {
      window.localStorage.setItem(kunci, JSON.stringify(nilai));
      return true;
    } catch (galat) {
      console.error('Gagal menyimpan ke localStorage:', galat);
      tampilkanToast('Gagal menyimpan data. Periksa pengaturan browser kamu.', 'error');
      return false;
    }
  }

  function simpanTugas() {
    return tulisPenyimpanan(KUNCI_TUGAS, state.tasks);
  }

  function simpanPref() {
    return tulisPenyimpanan(KUNCI_PREF, state.prefs);
  }

  /* =========================================================
     4. LAPISAN DATA TUGAS (CRUD)
     ========================================================= */

  // Membersihkan & memvalidasi data tugas dari localStorage
  function bersihkanTugas(mentah) {
    if (!Array.isArray(mentah)) return null;
    const hasil = [];
    for (const item of mentah) {
      if (!item || typeof item !== 'object') continue;

      const nama = typeof item.name === 'string' ? item.name.trim() : '';
      if (!nama) continue; // tugas tanpa nama tidak valid -> dilewati

      const deadline = dariISO(item.deadline) ? item.deadline : isoHariIni();
      const priority = BOBOT_PRIORITAS[item.priority] ? item.priority : 'sedang';
      const status = LABEL_STATUS[item.status] ? item.status : 'belum';

      hasil.push({
        id: typeof item.id === 'string' && item.id ? item.id : buatId(),
        name: nama,
        course: typeof item.course === 'string' && item.course.trim() ? item.course.trim() : 'Umum',
        deadline: deadline,
        priority: priority,
        status: status,
        note: typeof item.note === 'string' ? item.note : '',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : stempelWaktuLokal(),
        completedAt: status === 'selesai' && typeof item.completedAt === 'string' ? item.completedAt : (status === 'selesai' ? stempelWaktuLokal() : null),
        isDemo: item.isDemo === true
      });
    }
    return hasil;
  }

  // Membuat 8 tugas demo relatif terhadap hari ini (biar selalu relevan)
  function buatDataDemo() {
    const geser = function (jumlahHari) {
      const d = new Date();
      return keISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + jumlahHari));
    };

    const contoh = [
      { name: 'Laporan Praktikum 3: Percabangan', course: 'Dasar Pemrograman', offset: 0, priority: 'tinggi', status: 'sedang', note: 'Kumpulkan lewat GitHub Classroom sebelum jam 23.59.' },
      { name: 'Membuat 10 soal evaluasi Logika', course: 'Logika dan Algoritma', offset: 1, priority: 'sedang', status: 'belum', note: 'Sertakan kunci jawaban dan alasan singkat.' },
      { name: 'Presentasi micro-teaching', course: 'PTIK', offset: 2, priority: 'tinggi', status: 'belum', note: 'Durasi maksimal 10 menit, siapkan slide.' },
      { name: 'Esai refleksi nilai Pancasila', course: 'Pendidikan Pancasila', offset: 4, priority: 'rendah', status: 'belum', note: 'Minimal 500 kata, format PDF.' },
      { name: 'Latihan speaking: self introduction', course: 'Bahasa Inggris', offset: 6, priority: 'sedang', status: 'belum', note: 'Rekam video 2 menit, kirim ke dosen.' },
      { name: 'Membuat video pembelajaran 5 menit', course: 'PTIK', offset: 9, priority: 'sedang', status: 'belum', note: 'Topik bebas sesuai modul 4.' },
      { name: 'Tugas mandiri: flowchart program', course: 'Logika dan Algoritma', offset: -2, priority: 'tinggi', status: 'belum', note: 'Gunakan draw.io atau di gambar rapi.' },
      { name: 'Kuis harian Bab 2', course: 'Dasar Pemrograman', offset: -4, priority: 'rendah', status: 'selesai', note: 'Nilai 92. Sudah dikumpulkan.' }
    ];

    return contoh.map(function (item, indeks) {
      const deadline = geser(item.offset);
      const dibuat = geser(item.offset - (3 + indeks));
      const selesai = item.status === 'selesai';
      return {
        id: buatId(),
        name: item.name,
        course: item.course,
        deadline: deadline,
        priority: item.priority,
        status: item.status,
        note: item.note,
        createdAt: dibuat + 'T08:00:00',
        completedAt: selesai ? geser(item.offset - 1) + 'T20:15:00' : null,
        isDemo: true
      };
    });
  }

  // Memuat data awal: demo hanya dimasukkan kalau belum ada data tersimpan
  function muatDataAwal() {
    const tersimpan = bacaPenyimpanan(KUNCI_TUGAS);

    if (!tersimpan.ada) {
      state.tasks = buatDataDemo();
      state.demoAktif = true;
      tulisPenyimpanan(KUNCI_TUGAS, state.tasks);
      if (tersimpan.rusak) {
        tampilkanToast('Data lama tidak bisa dibaca, data demo dimuat ulang.', 'info');
      }
      return;
    }

    const bersih = bersihkanTugas(tersimpan.nilai);
    state.tasks = bersih === null ? [] : bersih;
    state.demoAktif = state.tasks.some(function (t) { return t.isDemo; });
  }

  function muatPref() {
    const tersimpan = bacaPenyimpanan(KUNCI_PREF);
    if (tersimpan.ada && tersimpan.nilai && typeof tersimpan.nilai === 'object') {
      const p = tersimpan.nilai;
      state.prefs.nama = typeof p.nama === 'string' ? p.nama : '';
      state.prefs.fokusMenit = angkaValid(p.fokusMenit, 1, 90, 25);
      state.prefs.istirahatMenit = angkaValid(p.istirahatMenit, 1, 90, 5);
      state.prefs.sesiFokus = angkaValid(p.sesiFokus, 0, 9999, 0);
      if (typeof p.page === 'string') state.page = p.page;
    }
  }

  function angkaValid(nilai, min, maks, bawaan) {
    const angka = Number(nilai);
    if (!isFinite(angka) || angka < min || angka > maks) return bawaan;
    return Math.round(angka);
  }

  // --- Operasi CRUD ---

  function tambahTugas(data) {
    const tugas = {
      id: buatId(),
      name: data.name,
      course: data.course,
      deadline: data.deadline,
      priority: data.priority,
      status: data.status,
      note: data.note,
      createdAt: stempelWaktuLokal(),
      completedAt: data.status === 'selesai' ? stempelWaktuLokal() : null,
      isDemo: false
    };
    state.tasks.push(tugas);
    simpanTugas();
    return tugas;
  }

  function ubahTugas(id, data) {
    const tugas = cariTugas(id);
    if (!tugas) return null;

    const sebelumnyaSelesai = tugas.status === 'selesai';
    tugas.name = data.name;
    tugas.course = data.course;
    tugas.deadline = data.deadline;
    tugas.priority = data.priority;
    tugas.note = data.note;

    if (tugas.status !== data.status) {
      tugas.status = data.status;
      // Catat waktu selesai hanya ketika status berubah menjadi selesai
      if (data.status === 'selesai' && !sebelumnyaSelesai) {
        tugas.completedAt = stempelWaktuLokal();
      } else if (data.status !== 'selesai') {
        tugas.completedAt = null;
      }
    }
    simpanTugas();
    return tugas;
  }

  function hapusTugas(id) {
    const indeks = state.tasks.findIndex(function (t) { return t.id === id; });
    if (indeks === -1) return false;
    state.tasks.splice(indeks, 1);
    simpanTugas();
    return true;
  }

  function cariTugas(id) {
    for (const tugas of state.tasks) {
      if (tugas.id === id) return tugas;
    }
    return null;
  }

  // Tandai selesai / batalkan selesai (dipakai tombol centang)
  function tandaiSelesai(id) {
    const tugas = cariTugas(id);
    if (!tugas) return null;
    if (tugas.status === 'selesai') {
      tugas.status = 'belum';
      tugas.completedAt = null;
    } else {
      tugas.status = 'selesai';
      tugas.completedAt = stempelWaktuLokal();
    }
    simpanTugas();
    return tugas;
  }

  /* =========================================================
     5. PERHITUNGAN: DEADLINE, URGENSI, STATISTIK
     ========================================================= */

  // Tingkat urgensi berdasarkan deadline (terpisah dari prioritas pengguna)
  function tingkatUrgensi(tugas) {
    if (tugas.status === 'selesai') return 'selesai';
    const sisa = selisihHari(tugas.deadline);
    if (sisa === null) return 'normal';
    if (sisa < 0) return 'terlambat';   // sudah lewat & belum selesai
    if (sisa <= 1) return 'urgent';     // hari ini atau besok
    if (sisa <= 3) return 'perhatian';  // 2-3 hari lagi
    return 'normal';                    // lebih dari 3 hari
  }

  // Label sisa hari sesuai ketentuan
  function labelDeadline(tugas) {
    const sisa = selisihHari(tugas.deadline);
    if (sisa === null) return 'Deadline tidak valid';

    if (tugas.status === 'selesai') {
      if (sisa === 0) return 'Selesai • deadline hari ini';
      if (sisa > 0) return 'Selesai • ' + sisa + ' hari sebelum deadline';
      return 'Selesai • ' + Math.abs(sisa) + ' hari terlambat';
    }

    if (sisa === 0) return 'Hari ini';
    if (sisa === 1) return 'Besok';
    if (sisa > 1) return sisa + ' hari lagi';
    return 'Terlambat ' + Math.abs(sisa) + ' hari';
  }

  function isTerlambat(tugas) {
    return tugas.status !== 'selesai' && tingkatUrgensi(tugas) === 'terlambat';
  }

  function hitungStatistik(tugas) {
    const total = tugas.length;
    let selesai = 0, sedang = 0, belum = 0, terlambat = 0, urgent = 0, perhatian = 0;

    for (const tugas of tugas) {
      if (tugas.status === 'selesai') { selesai++; continue; }
      if (tugas.status === 'sedang') sedang++; else belum++;
      const urg = tingkatUrgensi(tugas);
      if (urg === 'terlambat') terlambat++;
      else if (urg === 'urgent') urgent++;
      else if (urg === 'perhatian') perhatian++;
    }

    const belumSelesai = total - selesai;
    // Rumus progres: selesai / total * 100. Aman kalau total = 0.
    const progress = total === 0 ? 0 : Math.round((selesai / total) * 100);

    return {
      total: total,
      selesai: selesai,
      belumSelesai: belumSelesai,
      sedang: sedang,
      belum: belum,
      terlambat: terlambat,
      urgent: urgent,
      perhatian: perhatian,
      progress: progress
    };
  }

  // Menghitung jumlah tugas per tanggal berdasarkan kolom tertentu
  function hitungPerHari(tugas, kolom) {
    const peta = {};
    for (const tugas of tugas) {
      const nilai = tugas[kolom];
      if (!nilai || typeof nilai !== 'string') continue;
      const kunci = nilai.slice(0, 10); // ambil bagian YYYY-MM-DD
      peta[kunci] = (peta[kunci] || 0) + 1;
    }
    return peta;
  }

  function tujuhHariTerakhir() {
    const hasil = [];
    const dasar = hariIni();
    for (let i = 6; i >= 0; i--) {
      const tanggal = new Date(dasar.getFullYear(), dasar.getMonth(), dasar.getDate() - i);
      hasil.push({
        iso: keISO(tanggal),
        namaHari: tanggal.toLocaleDateString('id-ID', { weekday: 'short' }),
        tanggal: tanggal.getDate()
      });
    }
    return hasil;
  }

  function distribusiMataKuliah(tugas) {
    const peta = {};
    for (const tugas of tugas) {
      const nama = tugas.course || 'Umum';
      peta[nama] = (peta[nama] || 0) + 1;
    }
    return Object.keys(peta)
      .map(function (nama) {
        return { nama: nama, jumlah: peta[nama] };
      })
      .sort(function (a, b) { return b.jumlah - a.jumlah || a.nama.localeCompare(b.nama); });
  }

  // Achievement dihitung dari aktivitas nyata
  function hitungPencapaian(tugas) {
    const selesai = tugas.filter(function (t) { return t.status === 'selesai'; });

    const tepatWaktu = selesai.filter(function (t) {
      const deadline = dariISO(t.deadline);
      if (!deadline || !t.completedAt) return false;
      const selesaiPada = dariISO(t.completedAt.slice(0, 10));
      if (!selesaiPada) return false;
      // selesai pada atau sebelum tanggal deadline
      return selesaiPada.getTime() <= deadline.getTime();
    }).length;

    return [
      { id: 'first', judul: 'First Step', deskripsi: 'Selesaikan tugas pertamamu.', nilai: selesai.length, target: 1 },
      { id: 'gtd', judul: 'Getting Things Done', deskripsi: 'Selesaikan lima tugas.', nilai: selesai.length, target: 5 },
      { id: 'master', judul: 'Deadline Master', deskripsi: 'Selesaikan tiga tugas sebelum atau tepat pada deadline.', nilai: tepatWaktu, target: 3 }
    ];
  }

  /* =========================================================
     6. PENCARIAN, FILTER, PENGURUTAN
     ========================================================= */

  function nilaiWaktu(tugas, kolom) {
    if (!tugas[kolom] || typeof tugas[kolom] !== 'string') return 0;
    const waktu = new Date(tugas[kolom].replace(' ', 'T')).getTime();
    return isNaN(waktu) ? 0 : waktu;
  }

  function nilaiDeadline(tugas) {
    const tanggal = dariISO(tugas.deadline);
    return tanggal ? tanggal.getTime() : Number.MAX_SAFE_INTEGER;
  }

  // Terlambat selalu tampil lebih dulu, lalu deadline terdekat, lalu prioritas
  function urutkanTugas(daftar, mode) {
    const salinan = daftar.slice();

    const bandingTelat = function (a, b) {
      return (isTerlambat(b) ? 1 : 0) - (isTerlambat(a) ? 1 : 0);
    };
    const bandingPrioritas = function (a, b) {
      return BOBOT_PRIORITAS[b.priority] - BOBOT_PRIORITAS[a.priority];
    };

    if (mode === 'terbaru') {
      salinan.sort(function (a, b) {
        return nilaiWaktu(b, 'createdAt') - nilaiWaktu(a, 'createdAt');
      });
    } else if (mode === 'prioritas') {
      salinan.sort(function (a, b) {
        const telat = bandingTelat(a, b);
        if (telat !== 0) return telat;
        const prioritas = bandingPrioritas(a, b);
        if (prioritas !== 0) return prioritas;
        return nilaiDeadline(a) - nilaiDeadline(b);
      });
    } else {
      // default: deadline terdekat
      salinan.sort(function (a, b) {
        const telat = bandingTelat(a, b);
        if (telat !== 0) return telat;
        const deadline = nilaiDeadline(a) - nilaiDeadline(b);
        if (deadline !== 0) return deadline;
        return bandingPrioritas(a, b);
      });
    }
    return pastikanArray(salinan);
  }

  // Jaga-jaga: pastikan hasil pengurutan selalu berbentuk array
  function pastikanArray(daftar) {
    return Array.isArray(daftar) ? daftar : [];
  }

  function tugasTersaring() {
    const kunci = state.query.trim().toLowerCase();

    const hasil = state.tasks.filter(function (tugas) {
      // Pencarian: nama tugas, mata kuliah, catatan
      if (kunci) {
        const bahan = (tugas.name + ' ' + tugas.course + ' ' + (tugas.note || '')).toLowerCase();
        if (bahan.indexOf(kunci) === -1) return false;
      }
      // Filter status
      if (state.filter === 'terlambat') {
        if (!isTerlambat(tugas)) return false;
      } else if (state.filter !== 'semua') {
        if (tugas.status !== state.filter) return false;
      }
      // Filter prioritas
      if (state.priority !== 'semua' && tugas.priority !== state.priority) return false;
      return true;
    });

    return urutkanTugas(hasil, state.sort);
  }

  /* =========================================================
     7. RENDER UI
     ========================================================= */

  /* ---------- Toast notifikasi ---------- */
  function tampilkanToast(pesan, tipe) {
    const wadah = $('toastWrap');
    if (!elemanAman(wadah)) return;

    const toast = buatElemen('div', 'toast toast-' + (tipe || 'info'));
    toast.setAttribute('role', 'status');
    const namaIkon = tipe === 'success' ? 'centang' : (tipe === 'error' ? 'peringatan' : 'info');
    toast.appendChild(elemenIkon(namaIkon));
    toast.appendChild(buatElemen('span', null, pesan));
    wadah.appendChild(toast);

    window.setTimeout(function () {
      toast.classList.add('is-out');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

  function elemanAman(el) { return !!el && typeof el === 'object'; }

  /* ---------- Header & navigasi ---------- */

  function renderHeader() {
    const nama = state.prefs.nama.trim();
    const sapaan = $('headerGreeting');
    if (sapaan) sapaan.textContent = 'Halo, ' + (nama || 'Mahasiswa') + '! 👋';

    const tanggalEl = $('headerDate');
    if (tanggalEl) tanggalEl.textContent = tanggalHariIniIndo();

    const avatar = $('userAvatar');
    if (avatar) {
      avatar.textContent = (nama ? nama.charAt(0).toUpperCase() : 'M');
      avatar.setAttribute('title', nama ? 'Akun lokal: ' + nama : 'Akun lokal');
    }
  }

  function pindahHalaman(namaHalaman) {
    const halamanValid = ['dashboard', 'tugas', 'statistik', 'pomodoro', 'pengaturan'];
    if (halamanValid.indexOf(namaHalaman) === -1) namaHalaman = 'dashboard';

    state.page = namaHalaman;
    state.prefs.page = namaHalaman;
    simpanPref();

    // Update tombol sidebar
    const tombolNav = document.querySelectorAll('.nav-item');
    for (const tombol of tombolNav) {
      const aktif = tombol.getAttribute('data-page') === namaHalaman;
      tombol.classList.toggle('is-active', aktif);
      if (aktif) tombol.setAttribute('aria-current', 'page');
      else tombol.removeAttribute('aria-current');
    }

    // Tampilkan halaman yang dipilih
    const halaman = document.querySelectorAll('.page');
    for (const el of halaman) {
      const aktif = el.id === 'page-' + namaHalaman;
      el.classList.toggle('is-active', aktif);
      if (aktif) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    }

    tutupDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bukaDrawer() {
    document.body.classList.add('sidebar-open');
    const overlay = $('sidebarOverlay');
    if (overlay) {
      overlay.hidden = false;
      window.requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
    }
    const tombol = $('btnMenu');
    if (tombol) tombol.setAttribute('aria-expanded', 'true');
  }

  function tutupDrawer() {
    document.body.classList.remove('sidebar-open');
    const overlay = $('sidebarOverlay');
    if (overlay) {
      overlay.classList.remove('is-visible');
      window.setTimeout(function () {
        if (!document.body.classList.contains('sidebar-open')) overlay.hidden = true;
      }, 260);
    }
    const tombol = $('btnMenu');
    if (tombol) tombol.setAttribute('aria-expanded', 'false');
  }

  /* ---------- Kartu statistik ---------- */

  function renderStatistikDashboard(stats) {
    const total = $('statTotal');
    if (total) total.textContent = String(stats.total);

    const totalFoot = $('statTotalFoot');
    if (totalFoot) {
      totalFoot.textContent = stats.total === 0
        ? 'Belum ada tugas'
        : stats.total + ' tugas tercatat';
    }

    const urgent = $('statUrgent');
    if (urgent) urgent.textContent = String(stats.urgent);

    const urgentFoot = $('statUrgentFoot');
    if (urgentFoot) {
      urgentFoot.textContent = stats.urgent === 0
        ? 'Tidak ada deadline ≤ 1 hari'
        : 'Deadline hari ini/besok';
    }

    const done = $('statDone');
    if (done) done.textContent = String(stats.selesai);

    const doneFoot = $('statDoneFoot');
    if (doneFoot) doneFoot.textContent = stats.selesai + ' dari ' + stats.total + ' tugas';

    const progress = $('statProgress');
    if (progress) progress.textContent = stats.progress + '%';

    const bar = $('statProgressBar');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(stats.progress));
      const isi = $('statProgressFill');
      if (isi) isi.style.width = stats.progress + '%';
    }

    // Badge jumlah tugas belum selesai di sidebar
    const badge = $('navBadgeTugas');
    if (badge) {
      badge.textContent = String(stats.belumSelesai);
      badge.setAttribute('title', stats.belumSelesai + ' tugas belum selesai');
    }
  }

  /* ---------- Satu kartu tugas ---------- */

  function buatKartuTugas(tugas, opsi) {
    opsi = opsi || {};
    const item = buatElemen('li', 'task-item' + (tugas.status === 'selesai' ? ' is-done' : ''));
    item.setAttribute('data-id', tugas.id);

    // Tombol centang (tandai selesai)
    const tombolCek = buatElemen('button', 'task-check' + (tugas.status === 'selesai' ? ' is-done' : ''));
    tombolCek.type = 'button';
    tombolCek.setAttribute('aria-label', tugas.status === 'selesai'
      ? 'Batalkan status selesai: ' + tugas.name
      : 'Tandai selesai: ' + tugas.name);
    tombolCek.appendChild(elemenIkon('cek'));
    tombolCek.addEventListener('click', function () {
      const sebelumnyaSelesai = tugas.status === 'selesai';
      tandaiSelesai(tugas.id);
      renderSemua();
      tampilkanToast(
        sebelumnyaSelesai ? 'Status selesai dibatalkan.' : 'Mantap! Tugas ditandai selesai. 🎉',
        sebelumnyaSelesai ? 'info' : 'success'
      );
    });
    item.appendChild(tombolCek);

    // Isi tugas
    const body = buatElemen('div', 'task-body');

    const barisJudul = buatElemen('div', 'task-title-row');
    barisJudul.appendChild(buatElemen('span', 'task-name', tugas.name));
    barisJudul.appendChild(buatBadgeUrgensi(tugas));
    barisJudul.appendChild(buatBadgePrioritas(tugas));
    if (tugas.isDemo) barisJudul.appendChild(buatElemen('span', 'badge badge-demo', 'Demo'));
    body.appendChild(barisJudul);

    const matkul = buatElemen('p', 'task-course');
    matkul.appendChild(buatElemen('span', null, tugas.course));
    if (!opsi.sembunyikanStatus) {
      const titik = buatElemen('i', 'dot-sep');
      matkul.appendChild(titik);
      matkul.appendChild(buatElemen('span', null, LABEL_STATUS[tugas.status]));
    }
    body.appendChild(matkul);

    if (tugas.note && tugas.note.trim()) {
      body.appendChild(buatElemen('p', 'task-note', tugas.note));
    }
    item.appendChild(body);

    // Info deadline & aksi
    const meta = buatElemen('div', 'task-meta');

    const deadline = buatElemen('p', 'task-deadline');
    const ikonKalender = elemenIkon('kalender');
    ikonKalender.setAttribute('aria-hidden', 'true');
    deadline.appendChild(ikonKalender);
    deadline.appendChild(buatElemen('span', null, labelDeadline(tugas)));
    meta.appendChild(deadline);

    if (!opsi.sembunyikanTanggal) {
      meta.appendChild(buatElemen('p', 'task-deadline', tanggalIndo(tugas.deadline)));
    }

    const aksi = buatElemen('div', 'task-actions');

    const tombolEdit = buatElemen('button', 'mini-btn');
    tombolEdit.type = 'button';
    tombolEdit.setAttribute('aria-label', 'Edit tugas: ' + tugas.name);
    tombolEdit.appendChild(elemenIkon('pensil'));
    tombolEdit.addEventListener('click', function () { bukaModalTugas(tugas.id); });
    aksi.appendChild(tombolEdit);

    const tombolHapus = buatElemen('button', 'mini-btn danger');
    tombolHapus.type = 'button';
    tombolHapus.setAttribute('aria-label', 'Hapus tugas: ' + tugas.name);
    tombolHapus.appendChild(elemenIkon('hapus'));
    tombolHapus.addEventListener('click', function () { mintaHapusTugas(tugas); });
    aksi.appendChild(tombolHapus);

    meta.appendChild(aksi);
    item.appendChild(meta);
    return item;
  }

  function buatBadgeUrgensi(tugas) {
    const urg = tingkatUrgensi(tugas);
    const peta = {
      urgent: { kelas: 'badge badge-danger', teks: 'Urgent', ikon: 'alarm' },
      perhatian: { kelas: 'badge badge-warning', teks: 'Perhatian', ikon: 'jam' },
      terlambat: { kelas: 'badge badge-danger', teks: 'Terlambat', ikon: 'peringatan' },
      normal: { kelas: 'badge badge-neutral', teks: 'Normal', ikon: 'kalender' },
      selesai: { kelas: 'badge badge-success', teks: 'Selesai', ikon: 'centang' }
    };
    const data = peta[urg] || peta.normal;
    const badge = buatElemen('span', data.kelas, data.teks);
    const ikon = elemenIkon(data.ikon);
    ikon.setAttribute('aria-hidden', 'true');
    badge.insertBefore(ikon, badge.firstChild);
    badge.setAttribute('title', 'Urgensi berdasarkan deadline');
    return badge;
  }

  function buatBadgePrioritas(tugas) {
    const peta = {
      tinggi: { kelas: 'badge badge-soft', teks: 'Prioritas: Tinggi' },
      sedang: { kelas: 'badge badge-neutral', teks: 'Prioritas: Sedang' },
      rendah: { kelas: 'badge badge-neutral', teks: 'Prioritas: Rendah' }
    };
    const data = peta[tugas.priority] || peta.sedang;
    const badge = buatElemen('span', data.kelas, data.teks);
    badge.setAttribute('title', 'Prioritas yang kamu pilih');
    return badge;
  }

  /* ---------- Dashboard ---------- */

  function renderDashboard() {
    const stats = hitungStatistik(state.tasks);
    renderStatistikDashboard(stats);

    // Teks hero menyesuaikan kondisi data
    const eyebrow = $('heroEyebrow');
    if (eyebrow) {
      eyebrow.textContent = stats.total === 0
        ? 'Mulai dari sini'
        : (stats.progress === 100 ? 'Semua tugas beres 🎉' : 'Ringkasan hari ini');
    }
    const sub = $('heroSubtitle');
    if (sub) {
      if (stats.total === 0) sub.textContent = 'Tambahkan tugas pertamamu dan mulai atur jadwal kuliah.';
      else if (stats.progress === 100) sub.textContent = 'Semua tugas sudah selesai. Saatnya beri penghargaan untuk diri sendiri!';
      else if (stats.terlambat > 0) sub.textContent = 'Ada ' + stats.terlambat + ' tugas terlambat. Kerjakan yang paling mendesak dulu.';
      else if (stats.urgent > 0) sub.textContent = 'Ada ' + stats.urgent + ' tugas dengan deadline sangat dekat. Fokus satu per satu.';
      else sub.textContent = stats.belumSelesai + ' tugas menunggu untuk dikerjakan. Kamu pasti bisa!';
    }

    // Tugas terdekat (yang belum selesai, diurutkan deadline)
    const wadahUpcoming = $('upcomingList');
    if (elemanAman(wadahUpcoming)) {
      wadahUpcoming.textContent = '';
      const terdekat = urutkanTugas(
        state.tasks.filter(function (t) { return t.status !== 'selesai'; }),
        'deadline'
      ).slice(0, 5);

      if (terdekat.length === 0) {
        wadahUpcoming.appendChild(buatEmptyStateInline(
          state.tasks.length === 0 ? 'Belum ada tugas' : 'Semua tugas sudah selesai',
          state.tasks.length === 0
            ? 'Tekan “Tambah Tugas” untuk mulai menyusun rencana belajar.'
            : 'Kerja bagus! Tambahkan tugas baru kalau sudah ada materi berikutnya.'
        ));
      } else {
        for (const tugas of terdekat) {
          wadahUpcoming.appendChild(buatKartuTugas(tugas, { sembunyikanTanggal: true }));
        }
      }
    }

    // Grafik mingguan
    gambarGrafikMingguan($('chartWrap'));

    // Kartu motivasi
    const motivasi = $('motivationText');
    if (motivasi) {
      const indeks = (stats.total + stats.selesai) % MOTIVASI.length;
      motivasi.textContent = MOTIVASI[indeks];
    }
  }

  function buatEmptyStateInline(judul, pesan) {
    const li = buatElemen('li', 'empty-state-inline');
    const ikon = elemenIkon('buku');
    ikon.setAttribute('aria-hidden', 'true');
    li.appendChild(ikon);
    li.appendChild(buatElemen('h4', null, judul));
    li.appendChild(buatElemen('p', null, pesan));
    return li;
  }

  /* ---------- Halaman Daftar Tugas ---------- */

  function renderHalamanTugas() {
    const wadah = $('taskList');
    const empty = $('taskEmpty');
    const label = $('taskCountLabel');
    if (!elemanAman(wadah)) return;

    const tersaring = tugasTersaring();
    wadah.textContent = '';

    const adaFilterAktif = state.query.trim() !== '' || state.filter !== 'semua' || state.priority !== 'semua';

    if (label) {
      label.textContent = adaFilterAktif
        ? 'Menampilkan ' + tersaring.length + ' dari ' + state.tasks.length + ' tugas'
        : state.tasks.length + ' tugas tersimpan';
    }

    if (tersaring.length === 0) {
      wadah.setAttribute('hidden', '');
      if (empty) {
        empty.hidden = false;
        empty.textContent = '';
        empty.appendChild(buatEmptyStateBesar(adaFilterAktif, state.tasks.length));
      }
      return;
    }

    if (empty) empty.hidden = true;
    wadah.removeAttribute('hidden');

    for (const tugas of tersaring) {
      wadah.appendChild(buatKartuTugas(tugas));
    }
  }

  function buatEmptyStateBesar(adaFilterAktif, jumlahTotal) {
    const wadah = document.createDocumentFragment();
    const ikon = elemenIkon(adaFilterAktif ? 'target' : 'kotak');
    ikon.setAttribute('aria-hidden', 'true');
    wadah.appendChild(ikon);

    if (adaFilterAktif) {
      wadah.appendChild(buatElemen('h3', null, 'Tidak ada tugas yang cocok'));
      wadah.appendChild(buatElemen('p', null, 'Coba ubah kata kunci pencarian, filter status, atau filter prioritas kamu.'));
      const tombol = buatElemen('button', 'btn btn-soft btn-sm', 'Hapus semua filter');
      tombol.type = 'button';
      tombol.addEventListener('click', function () {
        state.query = '';
        state.filter = 'semua';
        state.priority = 'semua';
        const search = $('searchInput');
        if (search) search.value = '';
        const chips = document.querySelectorAll('#filterChips .chip');
        for (const chip of chips) chip.classList.toggle('is-active', chip.getAttribute('data-filter') === 'semua');
        const prioritas = $('priorityFilter');
        if (prioritas) prioritas.value = 'semua';
        renderSemua();
        tampilkanToast('Filter dikosongkan.', 'info');
      });
      wadah.appendChild(tombol);
    } else {
      wadah.appendChild(buatElemen('h3', null, jumlahTotal === 0 ? 'Belum ada tugas' : 'Daftar tugas kosong'));
      wadah.appendChild(buatElemen('p', null, 'Tambahkan tugas kuliah pertamamu untuk mulai memantau deadline dan progres belajar.'));
      const tombol = buatElemen('button', 'btn btn-primary btn-sm', 'Tambah Tugas');
      tombol.type = 'button';
      tombol.addEventListener('click', function () { bukaModalTugas(null); });
      wadah.appendChild(tombol);
    }
    return wadah;
  }

  /* ---------- Halaman Statistik ---------- */

  function renderHalamanStatistik() {
    const stats = hitungStatistik(state.tasks);

    const setTeks = function (id, nilai) {
      const el = $(id);
      if (el) el.textContent = String(nilai);
    };

    setTeks('stTotal', stats.total);
    setTeks('stDone', stats.selesai);
    setTeks('stPending', stats.belumSelesai);
    setTeks('stLate', stats.terlambat);
    setTeks('sessionCount', state.prefs.sesiFokus);

    const doneFoot = $('stDoneFoot');
    if (doneFoot) doneFoot.textContent = stats.total === 0 ? 'Belum ada tugas' : 'Penyelesaian ' + stats.progress + '%';

    const pendingFoot = $('stPendingFoot');
    if (pendingFoot) {
      pendingFoot.textContent = stats.belum + ' belum + ' + stats.sedang + ' sedang dikerjakan';
    }

    // Badge demo
    const badgeDemo = $('demoBadgeStats');
    if (badgeDemo) {
      badgeDemo.textContent = state.demoAktif ? 'Masih memakai Data Demo' : 'Data milik kamu';
      badgeDemo.className = state.demoAktif ? 'badge badge-demo' : 'badge badge-success';
    }

    // Distribusi mata kuliah
    const wadahMatkul = $('courseList');
    if (elemanAman(wadahMatkul)) {
      wadahMatkul.textContent = '';
      const distribusi = distribusiMataKuliah(state.tasks);

      if (distribusi.length === 0) {
        wadahMatkul.appendChild(buatEmptyStateInline('Belum ada data', 'Distribusi mata kuliah akan muncul setelah kamu menambah tugas.'));
      } else {
        for (const baris of distribusi) {
          const persen = stats.total === 0 ? 0 : Math.round((baris.jumlah / stats.total) * 100);
          const row = buatElemen('li', 'dist-row');

          const top = buatElemen('div', 'dist-top');
          top.appendChild(buatElemen('span', 'dist-name', baris.nama));
          top.appendChild(buatElemen('span', 'dist-count', baris.jumlah + ' tugas • ' + persen + '%'));
          row.appendChild(top);

          const track = buatElemen('div', 'dist-track');
          const isi = buatElemen('span', 'dist-fill');
          isi.style.width = persen + '%';
          track.appendChild(isi);
          row.appendChild(track);

          wadahMatkul.appendChild(row);
        }
      }
    }

    // Ringkasan produktivitas mingguan
    const hari = tujuhHariTerakhir();
    const petaDibuat = hitungPerHari(state.tasks, 'createdAt');
    const petaSelesai = hitungPerHari(state.tasks, 'completedAt');
    const dibuatMinggu = hari.reduce(function (total, h) { return total + (petaDibuat[h.iso] || 0); }, 0);
    const selesaiMinggu = hari.reduce(function (total, h) { return total + (petaSelesai[h.iso] || 0); }, 0);

    const wadahMini = $('weeklyMini');
    if (elemanAman(wadahMini)) {
      wadahMini.textContent = '';
      const data = [
        { nilai: dibuatMinggu, label: 'Tugas dibuat' },
        { nilai: selesaiMinggu, label: 'Tugas selesai' },
        { nilai: state.prefs.sesiFokus, label: 'Sesi fokus' }
      ];
      for (const item of data) {
        const kartu = buatElemen('div', 'mini-stat');
        kartu.appendChild(buatElemen('p', 'ms-value', String(item.nilai)));
        kartu.appendChild(buatElemen('p', 'ms-label', item.label));
        wadahMini.appendChild(kartu);
      }
    }

    gambarGrafikMingguan($('chartWrap2'));

    // Achievement
    renderPencapaian();
  }

  function renderPencapaian() {
    const wadah = $('achievementList');
    if (!elemanAman(wadah)) return;

    const daftar = hitungPencapaian(state.tasks);
    wadah.textContent = '';

    let terbuka = 0;
    for (const item of daftar) {
      const tercapai = item.nilai >= item.target;
      if (tercapai) terbuka++;

      const kartu = buatElemen('li', 'achievement' + (tercapai ? ' is-unlocked' : ''));
      const ikonWadah = buatElemen('span', 'ach-icon');
      const ikon = elemenIkon(tercapai ? 'piala' : 'target');
      ikon.setAttribute('aria-hidden', 'true');
      ikonWadah.appendChild(ikon);
      kartu.appendChild(ikonWadah);

      const isi = buatElemen('div');
      const judulBaris = buatElemen('div', 'ach-title');
      judulBaris.appendChild(buatElemen('span', null, item.judul));
      judulBaris.appendChild(buatElemen('span', tercapai ? 'badge badge-success' : 'badge badge-neutral',
        tercapai ? 'Terbuka' : 'Terkunci'));
      isi.appendChild(judulBaris);
      isi.appendChild(buatElemen('p', 'ach-desc', item.deskripsi));

      const persen = Math.min(100, Math.round((item.nilai / item.target) * 100));
      const track = buatElemen('div', 'ach-progress');
      const fill = buatElemen('span');
      fill.style.width = persen + '%';
      track.appendChild(fill);
      isi.appendChild(track);
      isi.appendChild(buatElemen('p', 'ach-meta', Math.min(item.nilai, item.target) + ' / ' + item.target));
      kartu.appendChild(isi);

      wadah.appendChild(kartu);
    }

    const hitungan = $('achCount');
    if (hitungan) hitungan.textContent = terbuka + ' / ' + daftar.length + ' terbuka';
  }

  /* ---------- Grafik mingguan (SVG, dibuat manual) ---------- */

  function gambarGrafikMingguan(wadah) {
    if (!elemanAman(wadah)) return;
    wadah.textContent = '';

    const hari = tujuhHariTerakhir();
    const petaDibuat = hitungPerHari(state.tasks, 'createdAt');
    const petaSelesai = hitungPerHari(state.tasks, 'completedAt');
    const dataDibuat = hari.map(function (h) { return petaDibuat[h.iso] || 0; });
    const dataSelesai = hari.map(function (h) { return petaSelesai[h.iso] || 0; });

    const maks = Math.max.apply(null, [1].concat(dataDibuat, dataSelesai));

    const LEBAR = 620, TINGGI = 216;
    const KIRI = 34, KANAN = 10, ATAS = 14, BAWAH = 44;
    const lebarPlot = LEBAR - KIRI - KANAN;
    const tinggiPlot = TINGGI - ATAS - BAWAH;
    const lebarGrup = lebarPlot / hari.length;

    const svg = buatSVG('svg', {
      viewBox: '0 0 ' + LEBAR + ' ' + TINGGI,
      role: 'img',
      'aria-label': 'Grafik batang tugas dibuat dan tugas selesai 7 hari terakhir'
    });

    // Garis bantu & label sumbu Y
    const tingkatY = [0, Math.ceil(maks / 2), maks];
    for (const nilai of tingkatY) {
      const y = ATAS + tinggiPlot - (nilai / maks) * tinggiPlot;
      svg.appendChild(buatSVG('line', {
        x1: KIRI, y1: y, x2: LEBAR - KANAN, y2: y, class: 'chart-grid-line'
      }));
      const teks = buatSVG('text', { x: KIRI - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-text' });
      teks.textContent = String(nilai);
      svg.appendChild(teks);
    }

    const adaAktivitas = dataDibuat.concat(dataSelesai).some(function (n) { return n > 0; });

    if (!adaAktivitas) {
      const teks = buatSVG('text', {
        x: KIRI + lebarPlot / 2, y: ATAS + tinggiPlot / 2,
        'text-anchor': 'middle', class: 'chart-axis-text'
      });
      teks.textContent = 'Belum ada aktivitas dalam 7 hari terakhir';
      svg.appendChild(teks);
    }

    const lebarBatang = 17, jarak = 6;

    hari.forEach(function (h, indeks) {
      const xGrup = KIRI + indeks * lebarGrup;
      const tengahGrup = xGrup + lebarGrup / 2;
      const xKiri = tengahGrup - lebarBatang - jarak / 2;
      const xKanan = tengahGrup + jarak / 2;

      const nilaiDibuat = dataDibuat[indeks];
      const nilaiSelesai = dataSelesai[indeks];

      const tinggiDibuat = (nilaiDibuat / maks) * tinggiPlot;
      const tinggiSelesai = (nilaiSelesai / maks) * tinggiPlot;

      if (nilaiDibuat > 0) {
        svg.appendChild(buatSVG('rect', {
          x: xKiri, y: ATAS + tinggiPlot - tinggiDibuat,
          width: lebarBatang, height: Math.max(tinggiDibuat, 3), rx: 4,
          class: 'chart-bar chart-bar-created'
        }));
        const label = buatSVG('text', {
          x: xKiri + lebarBatang / 2, y: ATAS + tinggiPlot - tinggiDibuat - 5,
          'text-anchor': 'middle', class: 'chart-axis-text'
        });
        label.textContent = String(nilaiDibuat);
        svg.appendChild(label);
      }

      if (nilaiSelesai > 0) {
        svg.appendChild(buatSVG('rect', {
          x: xKanan, y: ATAS + tinggiPlot - tinggiSelesai,
          width: lebarBatang, height: Math.max(tinggiSelesai, 3), rx: 4,
          class: 'chart-bar chart-bar-done'
        }));
        const label = buatSVG('text', {
          x: xKanan + lebarBatang / 2, y: ATAS + tinggiPlot - tinggiSelesai - 5,
          'text-anchor': 'middle', class: 'chart-axis-text'
        });
        label.textContent = String(nilaiSelesai);
        svg.appendChild(label);
      }

      // Label hari
      const teksHari = buatSVG('text', {
        x: tengahGrup, y: TINGGI - BAWAH + 20,
        'text-anchor': 'middle', class: 'chart-axis-text'
      });
      teksHari.textContent = h.namaHari;
      svg.appendChild(teksHari);

      const teksTanggal = buatSVG('text', {
        x: tengahGrup, y: TINGGI - BAWAH + 35,
        'text-anchor': 'middle', class: 'chart-axis-text'
      });
      teksTanggal.textContent = String(h.tanggal);
      svg.appendChild(teksTanggal);
    });

    wadah.appendChild(svg);
  }

  /* ---------- Halaman Pengaturan ---------- */

  function renderPengaturan() {
    const nama = $('inputUserName');
    if (nama && document.activeElement !== nama) nama.value = state.prefs.nama;

    const fokus = $('inputFocusMin');
    if (fokus && document.activeElement !== fokus) fokus.value = String(state.prefs.fokusMenit);

    const istirahat = $('inputBreakMin');
    if (istirahat && document.activeElement !== istirahat) istirahat.value = String(state.prefs.istirahatMenit);

    const info = $('infoTaskCount');
    if (info) info.textContent = state.tasks.length + ' tugas';
  }

  /* ---------- Render semua ---------- */

  function renderSemua() {
    renderHeader();
    renderDashboard();
    renderHalamanTugas();
    renderHalamanStatistik();
    renderPengaturan();
    perbaruiTampilanTimer();
  }

  /* =========================================================
     POMODORO (dihitung dari timestamp agar akurat)
     ========================================================= */

  const timer = {
    mode: 'fokus',           // 'fokus' | 'istirahat'
    durasiMs: 25 * 60 * 1000,
    sisaMs: 25 * 60 * 1000,
    berjalan: false,
    waktuSelesai: 0,         // timestamp kapan timer habis
    intervalId: null
  };

  function durasiMode(mode) {
    return (mode === 'istirahat' ? state.prefs.istirahatMenit : state.prefs.fokusMenit) * 60 * 1000;
  }

  function formatMMSS(ms) {
    const totalDetik = Math.max(0, Math.ceil(ms / 1000));
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    return String(menit).padStart(2, '0') + ':' + String(detik).padStart(2, '0');
  }

  function aturLingkaran(el, r, persen) {
    if (!el) return;
    const keliling = 2 * Math.PI * r;
    el.style.strokeDasharray = String(keliling);
    el.style.strokeDashoffset = String(keliling * (1 - persen));
  }

  function perbaruiTampilanTimer() {
    const teks = formatMMSS(timer.sisaMs);
    const persen = timer.durasiMs === 0 ? 0 : timer.sisaMs / timer.durasiMs;
    const modeIstirahat = timer.mode === 'istirahat';

    // Widget mini di dashboard
    const miniTime = $('miniTime');
    if (miniTime) miniTime.textContent = teks;
    const miniMode = $('miniMode');
    if (miniMode) {
      miniMode.textContent = modeIstirahat ? 'Istirahat' : 'Fokus';
      miniMode.className = modeIstirahat ? 'badge badge-success' : 'badge badge-primary';
    }
    const miniRing = $('miniRing');
    aturLingkaran(miniRing, 52, persen);
    if (miniRing) miniRing.classList.toggle('is-break', modeIstirahat);

    const miniNote = $('miniNote');
    if (miniNote) {
      miniNote.textContent = timer.berjalan
        ? (modeIstirahat ? 'Istirahat dulu, jangan lupa minum air.' : 'Timer berjalan. Tetap fokus!')
        : 'Tekan mulai saat siap belajar.';
    }

    // Halaman Pomodoro
    const waktu = $('pomoTime');
    if (waktu) waktu.textContent = teks;

    const labelMode = $('pomoModeLabel');
    if (labelMode) labelMode.textContent = modeIstirahat ? 'Mode Istirahat' : 'Mode Fokus';

    const hint = $('pomoHint');
    if (hint) {
      hint.textContent = timer.berjalan
        ? 'Berjalan…'
        : (timer.sisaMs === timer.durasiMs ? 'Siap belajar' : 'Dijeda');
    }

    const bigRing = $('bigRing');
    aturLingkaran(bigRing, 104, persen);
    if (bigRing) bigRing.classList.toggle('is-break', modeIstirahat);

    // Status tombol
    const setDisabled = function (id, nilai) {
      const el = $(id);
      if (el) el.disabled = nilai;
    };
    setDisabled('btnStart', timer.berjalan);
    setDisabled('miniStart', timer.berjalan);
    setDisabled('btnPause', !timer.berjalan);
    setDisabled('btnResume', timer.berjalan || timer.sisaMs === timer.durasiMs);
    setDisabled('btnReset', timer.sisaMs === timer.durasiMs && !timer.berjalan);

    // Tombol mode
    const tombolFokus = $('modeFocus');
    const tombolIstirahat = $('modeBreak');
    if (tombolFokus) tombolFokus.classList.toggle('is-active', !modeIstirahat);
    if (tombolIstirahat) tombolIstirahat.classList.toggle('is-active', modeIstirahat);

    // Hitungan sesi
    const sesi = $('sessionCount');
    if (sesi) sesi.textContent = String(state.prefs.sesiFokus);
  }

  function hentikanInterval() {
    if (timer.intervalId !== null) {
      window.clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  }

  function tickTimer() {
    // Hitung selisih timestamp: tetap akurat walau tab di background
    const sisa = timer.waktuSelesai - Date.now();
    if (sisa <= 0) {
      timer.sisaMs = 0;
      hentikanInterval();
      timer.berjalan = false;
      perbaruiTampilanTimer();
      selesaiTimer();
      return;
    }
    timer.sisaMs = sisa;
    perbaruiTampilanTimer();
  }

  function mulaiTimer() {
    if (timer.berjalan) return;
    if (timer.sisaMs <= 0) timer.sisaMs = timer.durasiMs;
    timer.waktuSelesai = Date.now() + timer.sisaMs;
    timer.berjalan = true;
    hentikanInterval();
    timer.intervalId = window.setInterval(tickTimer, 200);
    sembunyikanNotifTimer();
    perbaruiTampilanTimer();
  }

  function jedaTimer() {
    if (!timer.berjalan) return;
    timer.sisaMs = Math.max(0, timer.waktuSelesai - Date.now());
    timer.berjalan = false;
    hentikanInterval();
    perbaruiTampilanTimer();
  }

  function lanjutkanTimer() {
    if (timer.berjalan) return;
    if (timer.sisaMs <= 0) {
      resetTimer();
      mulaiTimer();
      return;
    }
    mulaiTimer();
  }

  function resetTimer() {
    hentikanInterval();
    timer.berjalan = false;
    timer.sisaMs = timer.durasiMs;
    timer.waktuSelesai = 0;
    sembunyikanNotifTimer();
    perbaruiTampilanTimer();
  }

  function gantiMode(mode) {
    if (mode !== 'fokus' && mode !== 'istirahat') mode = 'fokus';
    timer.mode = mode;
    timer.durasiMs = durasiMode(mode);
    resetTimer();
  }

  function tampilkanNotifTimer(pesan, fokus) {
    const kotak = $('pomoAlert');
    if (!kotak) return;
    kotak.hidden = false;
    kotak.className = 'pomo-alert' + (fokus ? ' is-focus' : '');
    kotak.textContent = '';
    const ikon = elemenIkon(fokus ? 'roket' : 'centang');
    ikon.setAttribute('aria-hidden', 'true');
    kotak.appendChild(ikon);
    kotak.appendChild(buatElemen('span', null, pesan));
  }

  function sembunyikanNotifTimer() {
    const kotak = $('pomoAlert');
    if (kotak) {
      kotak.hidden = true;
      kotak.textContent = '';
    }
  }

  function selesaiTimer() {
    if (timer.mode === 'fokus') {
      state.prefs.sesiFokus += 1;
      simpanPref();
      tampilkanNotifTimer('Sesi fokus selesai! Saatnya istirahat ' + state.prefs.istirahatMenit + ' menit. ☕', true);
      tampilkanToast('Sesi fokus selesai. Kerja bagus! 🎉', 'success');
      timer.mode = 'istirahat';
    } else {
      tampilkanNotifTimer('Istirahat selesai. Ayo kembali fokus! 💪', false);
      tampilkanToast('Istirahat selesai. Siap fokus lagi?', 'info');
      timer.mode = 'fokus';
    }
    timer.durasiMs = durasiMode(timer.mode);
    timer.sisaMs = timer.durasiMs;
    perbaruiTampilanTimer();
    renderHalamanStatistik();
  }

  /* =========================================================
     MODAL TUGAS (Tambah / Edit) + VALIDASI
     ========================================================= */

  let elemenFokusSebelumModal = null;

  function bukaModalTugas(idTugas) {
    const modal = $('taskModal');
    if (!modal) return;

    elemenFokusSebelumModal = document.activeElement;
    bersihkanErrorForm();

    const tugas = idTugas ? cariTugas(idTugas) : null;

    $('modalTitle').textContent = tugas ? 'Edit Tugas' : 'Tambah Tugas';
    $('modalDesc').textContent = tugas
      ? 'Perbarui data tugas kamu, lalu simpan perubahan.'
      : 'Lengkapi data tugas kuliah kamu.';
    $('taskId').value = tugas ? tugas.id : '';

    $('fieldName').value = tugas ? tugas.name : '';
    $('fieldDeadline').value = tugas ? tugas.deadline : isoHariIni();

    const selectMatkul = $('fieldCourse');
    const namaMatkul = tugas ? tugas.course : '';
    const adaDiDaftar = MATA_KULIAH.indexOf(namaMatkul) !== -1;

    if (tugas && namaMatkul && !adaDiDaftar) {
      selectMatkul.value = '__lainnya';
      $('fieldCourseOther').value = namaMatkul;
      $('wrapCourseOther').hidden = false;
    } else {
      selectMatkul.value = adaDiDaftar ? namaMatkul : '';
      $('fieldCourseOther').value = '';
      $('wrapCourseOther').hidden = true;
    }

    $('fieldPriority').value = tugas ? tugas.priority : 'sedang';
    $('fieldNote').value = tugas ? (tugas.note || '') : '';

    const status = tugas ? tugas.status : 'belum';
    const radios = document.querySelectorAll('input[name="statusTask"]');
    for (const radio of radios) radio.checked = (radio.value === status);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () { $('fieldName').focus(); }, 40);
  }

  function tutupModalTugas() {
    const modal = $('taskModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (elemenFokusSebelumModal && elemenFokusSebelumModal.focus) elemenFokusSebelumModal.focus();
  }

  function bersihkanErrorForm() {
    const daftarError = ['errName', 'errCourse', 'errCourseOther', 'errDeadline'];
    for (const id of daftarError) {
      const el = $(id);
      if (el) el.textContent = '';
    }
    const bidang = ['fieldName', 'fieldCourse', 'fieldCourseOther', 'fieldDeadline'];
    for (const id of bidang) {
      const el = $(id);
      if (el) el.classList.remove('has-error');
    }
  }

  function tampilkanError(idError, idBidang, pesan) {
    const error = $(idError);
    if (error) error.textContent = pesan;
    const bidang = $(idBidang);
    if (bidang) bidang.classList.add('has-error');
  }

  // Validasi formulir sebelum menyimpan
  function validasiForm() {
    bersihkanErrorForm();
    let valid = true;

    const nama = $('fieldName').value.trim();
    if (!nama) {
      tampilkanError('errName', 'fieldName', 'Nama tugas wajib diisi.');
      valid = false;
    } else if (nama.length < 3) {
      tampilkanError('errName', 'fieldName', 'Nama tugas minimal 3 karakter.');
      valid = false;
    }

    const pilihanMatkul = $('fieldCourse').value;
    let matkul = '';
    if (!pilihanMatkul) {
      tampilkanError('errCourse', 'fieldCourse', 'Mata kuliah wajib dipilih.');
      valid = false;
    } else if (pilihanMatkul === '__lainnya') {
      matkul = $('fieldCourseOther').value.trim();
      if (!matkul) {
        tampilkanError('errCourseOther', 'fieldCourseOther', 'Tulis nama mata kuliah kamu.');
        valid = false;
      }
    } else {
      matkul = pilihanMatkul;
    }

    const deadline = $('fieldDeadline').value;
    if (!deadline) {
      tampilkanError('errDeadline', 'fieldDeadline', 'Deadline wajib diisi.');
      valid = false;
    } else if (!dariISO(deadline)) {
      tampilkanError('errDeadline', 'fieldDeadline', 'Format tanggal tidak valid.');
      valid = false;
    }

    return {
      valid: valid,
      name: nama,
      course: matkul,
      deadline: deadline,
      priority: $('fieldPriority').value,
      note: $('fieldNote').value.trim(),
      status: (document.querySelector('input[name="statusTask"]:checked') || {}).value || 'belum'
    };
  }

  function simpanDariForm(event) {
    event.preventDefault();
    const data = validasiForm();
    if (!data.valid) {
      tampilkanToast('Ada data yang belum benar. Periksa kembali formulir.', 'error');
      // Fokuskan bidang pertama yang bermasalah
      const bidangError = document.querySelector('.has-error');
      if (bidangError) bidangError.focus();
      return;
    }

    const id = $('taskId').value;
    if (id) {
      ubahTugas(id, data);
      tampilkanToast('Tugas berhasil diperbarui.', 'success');
    } else {
      tambahTugas(data);
      tampilkanToast('Tugas baru berhasil ditambahkan.', 'success');
    }

    tutupModalTugas();
    renderSemua();
  }

  /* ---------- Dialog konfirmasi ---------- */

  let aksiKonfirmasi = null;

  function tanyaKonfirmasi(opsi) {
    const modal = $('confirmModal');
    if (!modal) return;

    $('confirmTitle').textContent = opsi.judul || 'Konfirmasi';
    $('confirmDesc').textContent = opsi.pesan || 'Apakah kamu yakin?';
    $('btnConfirmOk').textContent = opsi.labelOk || 'Ya, lanjutkan';

    aksiKonfirmasi = typeof opsi.onOk === 'function' ? opsi.onOk : null;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(function () { $('btnConfirmOk').focus(); }, 40);
  }

  function tutupKonfirmasi() {
    const modal = $('confirmModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    aksiKonfirmasi = null;
  }

  function jalankanKonfirmasi() {
    const aksi = aksiKonfirmasi;
    tutupKonfirmasi();
    if (aksi) aksi();
  }

  function mintaHapusTugas(tugas) {
    tanyaKonfirmasi({
      judul: 'Hapus tugas?',
      pesan: 'Tugas “' + tugas.name + '” akan dihapus permanen dari browser ini. Tindakan ini tidak bisa dibatalkan.',
      labelOk: 'Ya, hapus',
      onOk: function () {
        hapusTugas(tugas.id);
        renderSemua();
        tampilkanToast('Tugas dihapus.', 'info');
      }
    });
  }

  /* =========================================================
     8. EVENT HANDLER & INISIALISASI
     ========================================================= */

  function pasangEventHandler() {
    /* --- Navigasi sidebar --- */
    const tombolNav = document.querySelectorAll('.nav-item');
    for (const tombol of tombolNav) {
      tombol.addEventListener('click', function () {
        pindahHalaman(tombol.getAttribute('data-page'));
      });
    }

    // Tombol "Lihat semua" / "Buka timer"
    const tombolGoto = document.querySelectorAll('[data-goto]');
    for (const tombol of tombolGoto) {
      tombol.addEventListener('click', function () {
        pindahHalaman(tombol.getAttribute('data-goto'));
      });
    }

    /* --- Drawer mobile --- */
    const btnMenu = $('btnMenu');
    if (btnMenu) btnMenu.addEventListener('click', bukaDrawer);
    const overlay = $('sidebarOverlay');
    if (overlay) overlay.addEventListener('click', tutupDrawer);

    /* --- Tombol tambah tugas --- */
    const tombolTambah = [$('btnAddTask'), $('btnAddTask2'), $('heroAddTask')];
    for (const tombol of tombolTambah) {
      if (tombol) tombol.addEventListener('click', function () { bukaModalTugas(null); });
    }
    const heroGoTasks = $('heroGoTasks');
    if (heroGoTasks) heroGoTasks.addEventListener('click', function () { pindahHalaman('tugas'); });

    /* --- Pencarian --- */
    const search = $('searchInput');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        renderHalamanTugas();
        // Daftar tugas terdekat di dashboard juga ikut tersaring
        renderDashboard();
      });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          search.value = '';
          state.query = '';
          renderHalamanTugas();
          renderDashboard();
        }
      });
    }

    /* --- Filter status (chip) --- */
    const chips = document.querySelectorAll('#filterChips .chip');
    for (const chip of chips) {
      chip.addEventListener('click', function () {
        state.filter = chip.getAttribute('data-filter');
        for (const c of chips) c.classList.toggle('is-active', c === chip);
        renderHalamanTugas();
      });
    }

    /* --- Filter prioritas & pengurutan --- */
    const priorityFilter = $('priorityFilter');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', function () {
        state.priority = priorityFilter.value;
        renderHalamanTugas();
      });
    }

    const sortSelect = $('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sort = sortSelect.value;
        renderHalamanTugas();
      });
    }

    /* --- Modal tugas --- */
    const btnClose = $('btnCloseModal');
    if (btnClose) btnClose.addEventListener('click', tutupModalTugas);
    const btnCancel = $('btnCancelModal');
    if (btnCancel) btnCancel.addEventListener('click', tutupModalTugas);

    const modalTugas = $('taskModal');
    if (modalTugas) {
      modalTugas.addEventListener('click', function (e) {
        if (e.target === modalTugas) tutupModalTugas();
      });
    }

    const form = $('taskForm');
    if (form) form.addEventListener('submit', simpanDariForm);

    // Tampilkan input "mata kuliah lain" saat opsi Lainnya dipilih
    const selectMatkul = $('fieldCourse');
    if (selectMatkul) {
      selectMatkul.addEventListener('change', function () {
        const lain = selectMatkul.value === '__lainnya';
        $('wrapCourseOther').hidden = !lain;
        if (lain) window.setTimeout(function () { $('fieldCourseOther').focus(); }, 30);
      });
    }

    /* --- Dialog konfirmasi --- */
    const btnConfirmOk = $('btnConfirmOk');
    if (btnConfirmOk) btnConfirmOk.addEventListener('click', jalankanKonfirmasi);
    const btnConfirmCancel = $('btnConfirmCancel');
    if (btnConfirmCancel) btnConfirmCancel.addEventListener('click', tutupKonfirmasi);
    const modalConfirm = $('confirmModal');
    if (modalConfirm) {
      modalConfirm.addEventListener('click', function (e) {
        if (e.target === modalConfirm) tutupKonfirmasi();
      });
    }

    /* --- Tombol Escape: tutup modal/dialog/drawer --- */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('confirmModal').hidden) { tutupKonfirmasi(); return; }
      if (!$('taskModal').hidden) { tutupModalTugas(); return; }
      if (document.body.classList.contains('sidebar-open')) tutupDrawer();
    });

    /* --- Pomodoro --- */
    const tombolAksi = [
      ['btnStart', mulaiTimer],
      ['miniStart', mulaiTimer],
      ['btnPause', jedaTimer],
      ['btnResume', lanjutkanTimer],
      ['btnReset', resetTimer],
      ['miniReset', resetTimer]
    ];
    for (const [id, fungsi] of tombolAksi) {
      const el = $(id);
      if (el) el.addEventListener('click', fungsi);
    }

    const tombolMode = document.querySelectorAll('.mode-btn');
    for (const tombol of tombolMode) {
      tombol.addEventListener('click', function () {
        gantiMode(tombol.getAttribute('data-mode'));
      });
    }

    /* --- Pengaturan --- */
    const btnSaveName = $('btnSaveName');
    if (btnSaveName) {
      btnSaveName.addEventListener('click', function () {
        const nilai = $('inputUserName').value.trim();
        state.prefs.nama = nilai.slice(0, 24);
        simpanPref();
        renderHeader();
        renderPengaturan();
        $('nameMsg').textContent = 'Nama tersimpan.';
        window.setTimeout(function () {
          const msg = $('nameMsg');
          if (msg) msg.textContent = '';
        }, 2500);
      });
    }

    const btnSaveTimer = $('btnSaveTimer');
    if (btnSaveTimer) {
      btnSaveTimer.addEventListener('click', function () {
        const fokus = angkaValid($('inputFocusMin').value, 1, 90, state.prefs.fokusMenit);
        const istirahat = angkaValid($('inputBreakMin').value, 1, 90, state.prefs.istirahatMenit);
        state.prefs.fokusMenit = fokus;
        state.prefs.istirahatMenit = istirahat;
        simpanPref();
        timer.durasiMs = durasiMode(timer.mode);
        if (!timer.berjalan) {
          timer.sisaMs = timer.durasiMs;
        }
        renderPengaturan();
        perbaruiTampilanTimer();
        $('timerMsg').textContent = 'Durasi tersimpan.';
        window.setTimeout(function () {
          const msg = $('timerMsg');
          if (msg) msg.textContent = '';
        }, 2500);
      });
    }

    const btnResetDemo = $('btnResetDemo');
    if (btnResetDemo) {
      btnResetDemo.addEventListener('click', function () {
        tanyaKonfirmasi({
          judul: 'Reset data demo?',
          pesan: 'Tugas contoh akan diganti dengan 8 tugas demo baru. Tugas buatan kamu sendiri tidak dihapus.',
          labelOk: 'Ya, reset demo',
          onOk: function () {
            // Hapus tugas demo lama, lalu tambahkan set demo terbaru
            state.tasks = state.tasks.filter(function (t) { return !t.isDemo; });
            const demoBaru = buatDataDemo();
            for (const tugas of demoBaru) state.tasks.push(tugas);
            state.demoAktif = true;
            simpanTugas();
            renderSemua();
            tampilkanToast('Data demo berhasil dimuat ulang.', 'success');
          }
        });
      });
    }

    const btnClearAll = $('btnClearAll');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', function () {
        tanyaKonfirmasi({
          judul: 'Hapus semua tugas?',
          pesan: 'Semua tugas di browser ini akan dihapus. Pastikan kamu sudah menyalin data penting.',
          labelOk: 'Ya, hapus semua',
          onOk: function () {
            state.tasks = [];
            state.demoAktif = false;
            simpanTugas();
            renderSemua();
            tampilkanToast('Semua tugas telah dihapus.', 'info');
          }
        });
      });
    }

    /* --- Tutup drawer otomatis kalau layar dilebarkan --- */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 920) tutupDrawer();
    });
  }

  /* ---------- Inisialisasi aplikasi ---------- */

  function init() {
    muatPref();
    muatDataAwal();

    timer.durasiMs = durasiMode(timer.mode);
    timer.sisaMs = timer.durasiMs;

    pasangEventHandler();
    pindahHalaman(state.page || 'dashboard');
    renderSemua();

    // Simpan preferensi halaman terakhir
    simpanPref();

    // Info kecil untuk pengguna baru
    if (state.demoAktif) {
      window.setTimeout(function () {
        tampilkanToast('Data demo dimuat. Reset kapan saja di Pengaturan.', 'info');
      }, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
