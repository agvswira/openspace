// Mengubah file gambar menjadi foto profil persegi kecil (data URL JPEG) di browser,
// sehingga yang dikirim ke server hanya beberapa kilobyte, bukan file aslinya.
export function toAvatarDataUrl(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('File harus berupa gambar.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // potong bagian tengah agar persegi, lalu perkecil
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak dapat dibaca.'));
    };
    img.src = url;
  });
}
