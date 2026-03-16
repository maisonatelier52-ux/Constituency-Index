import Head from 'next/head';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { t } from '@/lib/i18n';

const fetcher = (url) => fetch(url).then((res) => res.json());

async function uploadFileToCloudinary(file, sig) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sig.apiKey);
  formData.append('timestamp', String(sig.timestamp));
  formData.append('signature', sig.signature);
  formData.append('folder', sig.folder);
  formData.append('allowed_formats', sig.allowedFormats.join(','));
  formData.append('max_file_size', String(sig.maxFileSize));

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error('Cloudinary upload failed');
  }

  const payload = await uploadRes.json();
  return payload.secure_url;
}

function getExt(filename = '') {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : '';
}

export default function ReportIssue() {
  const router = useRouter();
  const { data } = useSWR('/api/constituencies', fetcher);
  const constituencies = data?.constituencies || [];

  const [form, setForm] = useState({
    title: '',
    category: '',
    location: '',
    locationTags: '',
    evidenceUrls: '',
    constituency: '',
    deadline: '',
    latitude: '',
    longitude: '',
    description: ''
  });
  const [files, setFiles] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const minDeadline = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.category || !form.description) {
      setErrorMsg(t(router.locale, 'fillRequired'));
      return;
    }

    setUploading(true);

    try {
      const signRes = await fetch('/api/uploads/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'issues' })
      });

      if (!signRes.ok) {
        const err = await signRes.json();
        throw new Error(err.error || t(router.locale, 'uploadSignatureError'));
      }

      const sig = await signRes.json();

      if (files.length > sig.maxFiles) {
        throw new Error(`Maximum ${sig.maxFiles} files allowed.`);
      }

      const uploadedUrls = [];
      for (const file of files) {
        if (file.size > sig.maxFileSize) {
          throw new Error(`${file.name} exceeds size limit (${Math.round(sig.maxFileSize / (1024 * 1024))}MB).`);
        }

        const ext = getExt(file.name);
        if (ext && !sig.allowedFormats.includes(ext)) {
          throw new Error(`${file.name} has unsupported format. Allowed: ${sig.allowedFormats.join(', ')}`);
        }

        const url = await uploadFileToCloudinary(file, sig);
        uploadedUrls.push(url);
      }

      const manualUrls = form.evidenceUrls
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        ...form,
        title: form.title || form.category,
        locationTags: form.locationTags,
        evidenceUrls: [...manualUrls, ...uploadedUrls].join(',')
      };

      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const payloadError = await res.json();
        throw new Error(payloadError.error || 'Failed to report issue');
      }

      setSuccessMsg(t(router.locale, 'issueSuccess'));
      setForm({
        title: '',
        category: '',
        location: '',
        locationTags: '',
        evidenceUrls: '',
        constituency: '',
        deadline: '',
        latitude: '',
        longitude: '',
        description: ''
      });
      setFiles([]);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Head>
        <title>{t(router.locale, 'reportIssueTitle')} | MP Accountability Tracker</title>
      </Head>
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-4">{t(router.locale, 'reportIssueTitle')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg ? <p className="text-red-600">{errorMsg}</p> : null}
          {successMsg ? <p className="text-green-600">{successMsg}</p> : null}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="title">
              {t(router.locale, 'issueTitle')}
            </label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder={t(router.locale, 'issueTitle')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="category">
              {t(router.locale, 'category')} <span className="text-red-500">*</span>
            </label>
            <input
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="E.g., Healthcare, Roads, Education"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="location">
                {t(router.locale, 'location')}
              </label>
              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder={t(router.locale, 'location')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="deadline">
                {t(router.locale, 'resolutionDeadline')}
              </label>
              <input
                id="deadline"
                name="deadline"
                value={form.deadline}
                onChange={handleChange}
                type="date"
                min={minDeadline}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="latitude">
                {t(router.locale, 'latitude')}
              </label>
              <input
                id="latitude"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                type="number"
                step="any"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="9.9312"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="longitude">
                {t(router.locale, 'longitude')}
              </label>
              <input
                id="longitude"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                type="number"
                step="any"
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="76.2673"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="constituency">
              {t(router.locale, 'constituencies')}
            </label>
            <select
              id="constituency"
              name="constituency"
              value={form.constituency}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">{t(router.locale, 'selectConstituencyOptional')}</option>
              {constituencies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="locationTags">
              {t(router.locale, 'locationTags')}
            </label>
            <input
              id="locationTags"
              name="locationTags"
              value={form.locationTags}
              onChange={handleChange}
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="ward-10, market-road, near-school"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="evidenceUrls">
              {t(router.locale, 'evidenceUrls')}
            </label>
            <input
              id="evidenceUrls"
              name="evidenceUrls"
              value={form.evidenceUrls}
              onChange={handleChange}
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="https://...photo1.jpg, https://...video1.mp4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="evidenceFiles">
              {t(router.locale, 'uploadEvidenceFiles')}
            </label>
            <input
              id="evidenceFiles"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            {files.length > 0 ? (
              <p className="text-xs text-gray-600 mt-1">
                {files.length} {t(router.locale, 'filesSelected')}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="description">
              {t(router.locale, 'description')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 h-32"
              placeholder={t(router.locale, 'description')}
              required
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            disabled={uploading}
          >
            {uploading ? t(router.locale, 'uploading') : t(router.locale, 'submitIssue')}
          </button>
        </form>
      </div>
    </>
  );
}
