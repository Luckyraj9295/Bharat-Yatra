document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'http://localhost:5000/api';
  const token = localStorage.getItem('token');
  let userInfo;

  try {
    userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  } catch (err) {
    userInfo = {};
  }

  if (!token) {
    alert('No token found. Please log in.');
    location.href = '/';
  } else if (!userInfo.isAdmin) {
    alert('Access denied. Admins only.');
    location.href = '/';
  }

  const headers = { Authorization: 'Bearer ' + token };

  // ✅ Load Users
  async function loadUsers() {
    try {
      const res = await fetch(API_BASE + '/auth/users', { headers });
      if (!res.ok) throw new Error('Failed to load users');
      const users = await res.json();
      const tbody = document.querySelector('#userTable tbody');
      tbody.innerHTML = '';

      users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="px-3 py-2">${user.name}</td>
          <td class="px-3 py-2">${user.email}</td>
          <td class="px-3 py-2">${user.phone || '-'}</td>
          <td class="px-3 py-2">${user.city || ''}, ${user.state || ''}</td>
          <td class="px-3 py-2">
            ${user.isAdmin ? '<span class="text-green-600 font-semibold">Admin ✅</span>' : 'User'}
          </td>
        `;
        tbody.appendChild(row);
      });

    } catch (err) {
      console.error('🔴 Error loading users:', err.message);
    }
  }

  // ✅ Load Destinations
  async function loadDestinations() {
    const res = await fetch(API_BASE + '/destinations/all', { headers });
    const data = await res.json();
    const tbody = document.querySelector('#destTable tbody');
    tbody.innerHTML = '';

    data.forEach(d => {
      const imageURL = 'http://localhost:5000/' + d.imagePath.replace(/\\/g, '/');
      const brochureURL = 'http://localhost:5000/' + d.brochurePath.replace(/\\/g, '/');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2">
          <div class="font-semibold mb-1">${d.title}</div>
          <img src="${imageURL}" alt="Image" class="w-24 h-16 object-cover rounded shadow border">
        </td>
        <td class="px-3 py-2">₹${d.price}</td>
        <td class="px-3 py-2">${d.duration || '-'}</td>
        <td class="px-3 py-2">${d.moreDestination ? 'Yes' : 'No'}</td>
        <td class="px-3 py-2">
          ${d.brochurePath ? `<a href="${brochureURL}" target="_blank" class="text-blue-600 hover:underline text-sm">📄 Download</a><br/>` : ''}
          <button data-id="${d._id}" class="edit bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 text-sm rounded mt-1">Edit</button>
          <button data-id="${d._id}" class="del bg-red-500 hover:bg-red-600 text-white px-2 py-1 text-sm rounded mt-1">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  loadDestinations();

  document.querySelector('#destTable').addEventListener('click', async e => {
    if (e.target.classList.contains('edit')) {
      const id = e.target.dataset.id;
      const res = await fetch(API_BASE + '/destinations/all', { headers });
      const dest = (await res.json()).find(d => d._id === id);
      if (!dest) return;

      document.getElementById('destId').value = dest._id;
      document.getElementById('title').value = dest.title;
      document.getElementById('price').value = dest.price;
      document.getElementById('description').value = dest.description || '';
      document.getElementById('moreDestination').checked = dest.moreDestination;

      const [days = '', nights = ''] = (dest.duration || '').split(/ Days \/ |N/);
      document.getElementById('durationDays').value = days;
      document.getElementById('durationNights').value = nights;

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.target.classList.contains('del')) {
      if (!confirm('Delete destination?')) return;
      await fetch(API_BASE + '/destinations/' + e.target.dataset.id, {
        method: 'DELETE',
        headers
      });
      loadDestinations();
    }
  });

  document.getElementById('destForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('destId').value;
    const fd = new FormData();
    fd.append('title', document.getElementById('title').value);
    fd.append('price', document.getElementById('price').value);
    fd.append('description', document.getElementById('description').value);

    const days = document.getElementById('durationDays').value;
    const nights = document.getElementById('durationNights').value;
    fd.append('duration', `${days} Days / ${nights}N`);

    fd.append('moreDestination', document.getElementById('moreDestination').checked ? 'true' : 'false');

    const img = document.getElementById('image').files[0];
    const brochure = document.getElementById('brochure').files[0];
    if (img) fd.append('image', img);
    if (brochure) fd.append('brochure', brochure);

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/destinations/${id}` : `${API_BASE}/destinations`;
    await fetch(url, { method, headers, body: fd });

    e.target.reset();
    document.getElementById('destId').value = '';
    loadDestinations();
  });

  // ✅ Load Bookings
  async function loadBookings() {
    const res = await fetch(API_BASE + '/bookings', { headers });
    const data = await res.json();
    const tbody = document.querySelector('#bookingTable tbody');
    tbody.innerHTML = '';

    data.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2">${b.bookingRef || 'N/A'}</td>
        <td class="px-3 py-2">${b.user?.name || 'Unknown'}</td>
        <td class="px-3 py-2">${b.destination?.title || 'Unknown'}</td>
        <td class="px-3 py-2">${b.travelers?.length || 0}</td>
        <td class="px-3 py-2">₹${b.totalPrice || 0}</td>
        <td class="px-3 py-2 whitespace-pre-wrap text-sm text-gray-700">${b.specialRequests || '-'}</td>
        <td class="px-3 py-2">
          <button class="view-travelers bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 text-sm rounded shadow transition"
            data-ref="${b.bookingRef}"
            data-title="${b.destination?.title}"
            data-travelers='${JSON.stringify(b.travelers)}'
            data-email="${b.personalInfo?.email || ''}"
            data-phone="${b.personalInfo?.phone || ''}"
            data-state="${b.personalInfo?.state || ''}"
            data-city="${b.personalInfo?.city || ''}"
            data-pin="${b.personalInfo?.pin || ''}"
            data-date="${b.travelDate || ''}"
            data-requests="${b.specialRequests || ''}">
            View Details
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  // Traveler Modal Logic
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('view-travelers')) {
      const ref = e.target.dataset.ref;
      const title = e.target.dataset.title;
      const travelers = JSON.parse(e.target.dataset.travelers || '[]');

      document.getElementById('modalRef').textContent = ref;
      document.getElementById('modalDestination').textContent = title;
      document.getElementById('modalEmail').textContent = e.target.dataset.email;
      document.getElementById('modalPhone').textContent = e.target.dataset.phone;
      document.getElementById('modalState').textContent = e.target.dataset.state;
      document.getElementById('modalCity').textContent = e.target.dataset.city;
      document.getElementById('modalPin').textContent = e.target.dataset.pin;

      const dateElem = document.getElementById('modalDate');
      if (dateElem) {
        dateElem.textContent = new Date(e.target.dataset.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        dateElem.classList.add('font-semibold', 'text-gray-800');
      }

      const reqElem = document.getElementById('modalRequests');
      if (reqElem) {
        if (e.target.dataset.requests.trim()) {
          reqElem.textContent = e.target.dataset.requests;
          reqElem.closest('div').classList.remove('hidden');
        } else {
          reqElem.closest('div').classList.add('hidden');
        }
      }

      const tbody = document.getElementById('modalTravelerList');
      tbody.innerHTML = '';
      travelers.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="border px-2 py-1">${t.name}</td>
          <td class="border px-2 py-1">${t.age}</td>
          <td class="border px-2 py-1">${t.gender}</td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById('travelerModal').classList.remove('hidden');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    location.href = '/';
  });

  loadBookings();
  loadUsers(); // ⬅️ Final call to fetch users
});
