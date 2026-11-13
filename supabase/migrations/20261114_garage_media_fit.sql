-- Garage : l'espace privé garage-media accueille aussi l'étude posturale (PDF ou photo de la fiche) ; le film vidéo est retiré de l'app.
update storage.buckets set allowed_mime_types = array['model/gltf-binary', 'application/octet-stream', 'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
  where id = 'garage-media';
