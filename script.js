const BASE_URL = "https://bharat-yatra.onrender.com";
const API_BASE = `${BASE_URL}/api`;
const UPLOADS_BASE = BASE_URL;
const ADMIN_URL = `${window.location.origin}/admin/admin.html`;

// ✅ Verify Razorpay is loaded
console.log('📦 Checking Razorpay script load status...');
let razorpayReady = false;

function waitForRazorpay(callback, maxWait = 5000) {
  const startTime = Date.now();
  const checkRazorpay = () => {
    if (typeof window.Razorpay === 'function') {
      console.log('✅ Razorpay is ready');
      razorpayReady = true;
      callback();
      return;
    }
    
    if (Date.now() - startTime > maxWait) {
      console.error('❌ Razorpay failed to load after 5 seconds');
      return;
    }
    
    setTimeout(checkRazorpay, 100);
  };
  
  checkRazorpay();
}

// Start checking for Razorpay
waitForRazorpay(() => {
  console.log('🟢 Razorpay ready for use');
});

// Toggle more destinations
const toggleBtn = document.getElementById("toggleDestinationsBtn");
const moreDestinations = document.getElementById("moreDestinations");
const toggleIcon = document.getElementById("toggleIcon");
const toggleText = document.getElementById("toggleText");

let isExpanded = false;

toggleBtn?.addEventListener("click", () => {
  isExpanded = !isExpanded;

  if (isExpanded) {
    moreDestinations.classList.remove("hidden");
    toggleIcon.classList.remove("fa-chevron-down");
    toggleIcon.classList.add("fa-chevron-up");
    toggleText.textContent = "See Less";
  } else {
    moreDestinations.classList.add("hidden");
    toggleIcon.classList.remove("fa-chevron-up");
    toggleIcon.classList.add("fa-chevron-down");
    toggleText.textContent = "See More";
  }
});
function getAvatarUrl(user) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=F59E42&color=fff&rounded=true`;

  if (!user?.profileImage) return fallback;

  if (user.profileImage.startsWith('http')) {
    const timestamp = user._avatarUpdated || Date.now();
    return `${user.profileImage}?t=${timestamp}`;
  }

  const cleanedPath = user.profileImage.startsWith("/uploads/")
    ? user.profileImage.replace(/^\/uploads\//, "")
    : user.profileImage;

  const timestamp = user._avatarUpdated || Date.now(); // ✅ Use fresh cache buster

  return `${UPLOADS_BASE}/uploads/${cleanedPath.replace(/\\/g, '/')}` + `?t=${timestamp}`;
}

// Load destinations from backend
async function loadDestinations() {
  try {
    const res = await fetch(`${API_BASE}/destinations`);
    const destinations = await res.json();
    localStorage.setItem('destinations', JSON.stringify(destinations));


    const visibleGrid = document.querySelector("#destinations .grid");
    const hiddenGrid = document.getElementById("moreDestinations");

    destinations.forEach(dest => {
      const card = createDestinationCard(dest);
      const isMore = dest.moreDestination === true || dest.moreDestination === 'true';
      if (isMore) {
        hiddenGrid.appendChild(card);
      } else {
        visibleGrid.appendChild(card);
      }
    });
  } catch (err) {
    console.error('Failed to load destinations:', err);
  }
}
function populateDestinationSelect() {
  const destinationSelect = document.getElementById('destinationSelect');
  const destinations = JSON.parse(localStorage.getItem('destinations') || '[]');

  // Clear and repopulate select
  destinationSelect.innerHTML = '<option value="">-- Select Destination --</option>';
  destinations.forEach(dest => {
    const opt = document.createElement('option');
    opt.value = dest.title;
    opt.textContent = dest.title;
    destinationSelect.appendChild(opt);
  });
}

function createDestinationCard(dest) {
  const div = document.createElement("div");
  div.className =
    "destination-card bg-white rounded-lg overflow-hidden shadow-md transition duration-300";

  // Convert Windows paths to URLs
  const imgPath = dest.imagePath?.replace(/\\/g, "/");
  const brochurePath = dest.brochurePath?.replace(/\\/g, "/");
  const imgUrl = imgPath
    ? imgPath.startsWith('http')
      ? imgPath
      : encodeURI(`${UPLOADS_BASE}/${imgPath}`)
    : '';
  const brochureFileName = brochurePath?.split('/')?.pop();
  const brochureUrl = brochurePath
    ? brochurePath.startsWith('http')
      ? brochurePath
      : `${UPLOADS_BASE}/${brochurePath}`  // Use direct path for legacy support
    : '';
  const price = `₹${dest.price}/person`;
  const duration = dest.duration || "-";

  // Generate a hardcoded random rating between 3.5 and 4.9 (1 decimal)
  const avgRating = (Math.random() * 1.4 + 3.5).toFixed(1);
  const fullStars = Math.floor(avgRating);
  const hasHalfStar = avgRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const starHtml =
    '<i class="fas fa-star text-yellow-400 mr-0.5"></i>'.repeat(fullStars) +
    (hasHalfStar ? '<i class="fas fa-star-half-alt text-yellow-400 mr-0.5"></i>' : '') +
    '<i class="fas fa-star text-gray-300 mr-0.5"></i>'.repeat(emptyStars);

  div.innerHTML = `
    <div class="relative">
      ${brochureUrl ? `
      <button onclick="downloadBrochure('${brochureUrl}', '${dest.title}', '${dest.brochureName || ''}')" class="absolute top-2 left-2 bg-white bg-opacity-80 hover:bg-opacity-100 text-blue-600 px-2 py-1 text-xs rounded flex items-center space-x-1 shadow">
        <i class="fas fa-download text-sm"></i>
        <span>Brochure</span>
      </button>
      ` : ''}
      <img src="${imgUrl}" alt="${dest.title}" class="w-full h-64 object-cover">
    </div>
    <div class="p-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xl font-bold text-gray-800">${dest.title}</h3>
        <span class="inline-block text-xs font-semibold text-blue-200 bg-blue-700 rounded-full px-2 py-0.5 align-middle ml-2">${duration}</span>
      </div>
      <p class="text-gray-600 mb-2">${dest.description}</p>

      <!-- ⭐ Rating row -->
      <div class="flex items-center text-sm text-gray-600 mb-3">
        ${starHtml}
        <span class="ml-2 font-semibold">${avgRating}</span>
      </div>

      <!-- 💸 Price + Rate Now + Book Now row -->
      <div class="flex items-center justify-between mt-2">
        <span class="font-bold text-orange-500 text-sm">${price}</span>
        <div class="ml-auto flex items-center gap-4">
          <button onclick="startReview('${dest._id}', '${dest.title.replace(/'/g, "\\'")}')" class="text-sm text-orange-500 hover:underline">
            Rate Now
          </button>
          <button onclick="startBooking('${dest.title.replace(/'/g, "\\'")}', ${dest.price})"
            class="bg-orange-500 hover:bg-orange-600 text-white py-1.5 px-4 rounded-full text-sm transition duration-300">
            Book Now
          </button>
        </div>
      </div>
    </div>
  `;
  return div;
}

async function downloadBrochure(url, title, originalFileName) {
  try {
    if (!url || url === '') {
      showToast('❌ No brochure available for this destination.', 'error');
      return;
    }

    console.log('📥 Downloading brochure from:', url);
    console.log('📝 Original filename:', originalFileName);

    // Determine filename
    let filename;
    if (originalFileName && originalFileName.trim() !== '') {
      filename = originalFileName;
      console.log('📥 Using original filename:', originalFileName);
    } else {
      // Fallback: detect extension from URL
      let fileExtension = 'pdf';
      const urlWithoutParams = url.split('?')[0];
      const lastDot = urlWithoutParams.lastIndexOf('.');
      if (lastDot !== -1) {
        const detectedExt = urlWithoutParams.substring(lastDot + 1).toLowerCase();
        if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(detectedExt)) {
          fileExtension = detectedExt;
        }
      }
      const safeTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
      filename = `${safeTitle}_Brochure.${fileExtension}`;
      console.log('📥 Generated filename:', filename);
    }

    // Check if it's a PDF to decide download method
    const isPdf = url.includes('/raw/upload/') || url.includes('.pdf');
    let fetchUrl = url;
    
    console.log('🔍 File type detection:', { isPdf, url });

    // For PDFs, try direct download first, then fallback to signed URL
    if (isPdf) {
      console.log('📄 Attempting direct PDF download...');
      try {
        const directResponse = await fetch(url);
        console.log('📡 Direct fetch response:', directResponse.status, directResponse.statusText);
        
        if (directResponse.ok) {
          // Direct download worked
          const blob = await directResponse.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
          console.log('✅ Direct download successful');
          showToast('✅ Brochure download initiated!');
          return;
        } else if (directResponse.status === 401) {
          // Get signed URL from backend
          console.log('⚠️ Got 401, getting signed URL...');
          const signedUrlResponse = await fetch(`${API_BASE}/destinations/download-brochure?url=${encodeURIComponent(url)}`);
          
          if (!signedUrlResponse.ok) {
            throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
          }
          
          const { signedUrl } = await signedUrlResponse.json();
          console.log('✅ Got signed URL, downloading...');
          fetchUrl = signedUrl;
        } else {
          throw new Error(`Direct fetch failed: ${directResponse.status}`);
        }
      } catch (directErr) {
        console.warn('⚠️ Direct download failed, getting signed URL:', directErr.message);
        try {
          const signedUrlResponse = await fetch(`${API_BASE}/destinations/download-brochure?url=${encodeURIComponent(url)}`);
          
          if (!signedUrlResponse.ok) {
            throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
          }
          
          const { signedUrl } = await signedUrlResponse.json();
          console.log('✅ Got signed URL, downloading...');
          fetchUrl = signedUrl;
        } catch (signedErr) {
          console.error('❌ Failed to get signed URL:', signedErr);
          throw new Error(`Cannot access file: ${signedErr.message}`);
        }
      }
    }

    // Fetch the file (either image or via proxy for PDFs)
    console.log('📥 Fetching from:', fetchUrl);
    const response = await fetch(fetchUrl);
    console.log('📡 Fetch response:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const blob = await response.blob();

    if (isPdf && (contentType.includes('text/html') || contentType.includes('application/json') || blob.size < 1024)) {
      const maybeText = await blob.text();
      console.error('❌ Invalid PDF payload received:', { contentType, size: blob.size, preview: maybeText.slice(0, 200) });
      throw new Error('Invalid PDF payload received from server');
    }

    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);

    console.log('✅ Brochure download initiated');
    showToast('✅ Brochure download initiated!');
  } catch (err) {
    console.error('❌ Download failed:', err.message);
    console.error('❌ Full error:', err);
    showToast('❌ Failed to download brochure. ' + err.message, 'error');
  }
}

async function loadAllDynamicReviews() {
  const container = document.getElementById('dynamicReviewContainer');
  if (!container) return;

  container.innerHTML = ''; // Clear only dynamic reviews

  const destinations = JSON.parse(localStorage.getItem("destinations") || "[]");
  const allReviews = [];

  for (const dest of destinations) {
    try {
      const res = await fetch(`${API_BASE}/reviews/${dest._id}`);
      const reviews = await res.json();
      allReviews.push(...reviews);
    } catch (err) {
      console.error(`❌ Failed to load reviews for ${dest.title}:`, err);
    }
  }

  if (!allReviews.length) {
    showToast("No reviews available yet.", "info");
    return;
  }

  allReviews.forEach(r => {
    const name = r.user?.name || r.name || "Anonymous";
    const avatar = r.user?.profileImage ? getAvatarUrl(r.user) : "";
    const reviewEl = createTestimonialBox(name, r.rating, r.comment, avatar);
    container.appendChild(reviewEl);
  });
}


function createTestimonialBox(name, rating, comment, avatarUrl = '') {
  const initials = getInitials(name);
  const fallback = `<div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold mr-4">${initials}</div>`;
  const avatar = avatarUrl
    ? `<img src="${avatarUrl}" alt="${name}" class="w-12 h-12 rounded-full object-cover mr-4 border border-orange-300">`
    : fallback;

  const box = document.createElement('div');
  box.className = 'testimonial-box bg-gray-50 p-6 rounded-lg shadow-sm mx-2 min-w-[320px] max-w-[350px] flex-1';

  box.innerHTML = `
    <div class="flex items-center mb-4">
      ${avatar}
      <div>
        <h4 class="font-bold">${escapeHtml(name)}</h4>
        <div class="flex text-yellow-400">
          ${'<i class="fas fa-star"></i>'.repeat(rating)}${'<i class="fas fa-star text-gray-300"></i>'.repeat(5 - rating)}
        </div>
      </div>
    </div>
    <p class="text-gray-600">"${escapeHtml(comment)}"</p>
  `;
  return box;
}



function startReview(destinationId, title) {
  document.getElementById("addReview")?.scrollIntoView({ behavior: "smooth" });
  showToast(`Selected destination: ${title}`, "info");

  // Show in UI
  const displayEl = document.getElementById("selectedDestinationDisplay");
  if (displayEl) displayEl.textContent = title;

  // Store selection
  localStorage.setItem("selectedDestinationTitle", title);
  localStorage.setItem("selectedDestinationId", destinationId);
  localStorage.setItem("justRatedDestination", "true"); // ✅ set the flag

  loadReviewsForSelectedDestination(); // ✅ load immediately
}


// Run when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  (async () => {
    await loadDestinations();
    populateDestinationSelect(); // ✅ keep this if used elsewhere

    await loadAllDynamicReviews(); // ✅ Load all reviews from all destinations

    // Clear selection regardless of justRated flag
    localStorage.removeItem("justRatedDestination");
    localStorage.removeItem("selectedDestinationTitle");
    localStorage.removeItem("selectedDestinationId");

    const displayEl = document.getElementById("selectedDestinationDisplay");
    if (displayEl) displayEl.textContent = "(No destination selected)";
  })();
});


        function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-400 text-gray-900',
    info: 'bg-blue-600'
  }[type] || 'bg-gray-800';

  toast.className = `${bgColor} text-white px-4 py-2 rounded shadow-md animate-fadeIn transition-opacity duration-300`;

  toast.innerHTML = `<span class="font-semibold">${message}</span>`;

  const container = document.getElementById('toastContainer');
  container.innerHTML = ''; // replace any existing
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}


        // Navbar scroll effect
    window.addEventListener('scroll', function() {
        const nav = document.getElementById('mainNav');
        if (window.scrollY > 80) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

        // Mobile menu toggle
        document.getElementById('menuBtn').addEventListener('click', function() {
            const menu = document.getElementById('mobileMenu');
            menu.classList.toggle('hidden');
        });

        // Booking form navigation
        function nextStep(currentStep) {
            const userInfo = JSON.parse(localStorage.getItem('userInfo'));
const token = localStorage.getItem('token');
if (!userInfo || !token) {
  showToast('Please sign in to continue with the booking.', 'error');
  return;
}



            // Validate current step before proceeding
            if (currentStep === 1) {
                const destination = document.getElementById('destinationSelect').value;
                const travelDate = document.getElementById('travelDate').value;
                
                if (!destination) {
                    showToast('Please select a destination', 'warning');

                    return;
                }
                
                if (!travelDate) {
                    alert('Please select a travel date');
                    return;
                }
                
                 // Update summary in step 3
                updateBookingSummary();
            } else if (currentStep === 2) {
                const fullName = document.getElementById('fullName').value;
                const email = document.getElementById('email').value;
                const phone = document.getElementById('phone').value;
                const state = document.getElementById('state').value;
                const city = document.getElementById('city').value;
                const pincode = document.getElementById('pincode').value;
                const age = document.getElementById('age').value;
                const gender = document.getElementById('gender').value;

                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const phonePattern = /^\d{10}$/;

                if (!fullName || !email || !phone || !state || !city || !pincode || !age || !gender) {
                    showToast('Please fill in all required personal information', 'warning');

                    return;
                }
                if (!emailPattern.test(email)) {
                    alert('Please enter a valid email address');
                    return;
                }
                if (!phonePattern.test(phone)) {
                    alert('Please enter a valid 10-digit Indian mobile number');
                    return;
                }
            }
            
            // Hide current step
            document.getElementById(`step${currentStep}`).classList.add('hidden');
            // Show next step
            document.getElementById(`step${currentStep + 1}`).classList.remove('hidden');
            
            // Update progress steps
            document.querySelectorAll('.step').forEach((step, index) => {
                const circle = step.querySelector('div');
                if (index < currentStep) {
                    circle.classList.remove('bg-gray-300', 'text-gray-600');
                    circle.classList.add('bg-orange-500', 'text-white');
                } else if (index === currentStep) {
                    circle.classList.remove('bg-gray-300', 'text-gray-600');
                    circle.classList.add('bg-orange-500', 'text-white');
                } else {
                    circle.classList.add('bg-gray-300', 'text-gray-600');
                    circle.classList.remove('bg-orange-500', 'text-white');
                }
            });
        }
        
       function prevStep(currentStep) {
    // Hide current step
    document.getElementById(`step${currentStep}`).classList.add('hidden');
    // Show previous step
    document.getElementById(`step${currentStep - 1}`).classList.remove('hidden');

    // Scroll to top to avoid jumping down
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update progress steps
    document.querySelectorAll('.step').forEach((step, index) => {
        const circle = step.querySelector('div');
        if (index < currentStep - 1) {
            circle.classList.remove('bg-gray-300', 'text-gray-600');
            circle.classList.add('bg-orange-500', 'text-white');
        } else if (index === currentStep - 1) {
            circle.classList.remove('bg-gray-300', 'text-gray-600');
            circle.classList.add('bg-orange-500', 'text-white');
        } else {
            circle.classList.add('bg-gray-300', 'text-gray-600');
            circle.classList.remove('bg-orange-500', 'text-white');
        }
    });
}

        
        // Update booking summary in payment step
        function updateBookingSummary() {
  const destinationTitle = document.getElementById('destinationSelect').value;
  const packageType = document.getElementById('packageType').value;
  const travelDate = document.getElementById('travelDate').value;
  const travelersCount = parseInt(document.getElementById('travelersCount').value);

  // 🧠 Get all destinations from localStorage
  const destinations = JSON.parse(localStorage.getItem('destinations') || '[]');

  // 🔍 Find the destination object by title
  const selectedDestination = destinations.find(
    dest => dest.title.trim().toLowerCase() === destinationTitle.trim().toLowerCase()
  );

  if (!selectedDestination) {
    showToast('Selected destination not found in localStorage.', 'error');
    return;
  }

  // ✅ Get base price from backend (not hardcoded)
  let basePrice = selectedDestination.price || 0;

  // 💼 Apply package multipliers
  switch (packageType) {
    case 'Deluxe': basePrice *= 1.5; break;
    case 'Premium': basePrice *= 2; break;
  }

  // 💸 Final price calculation
  const totalPrice = basePrice * travelersCount;
  const taxes = totalPrice * 0.05;
  const grandTotal = totalPrice + taxes;

  // 🧾 Update booking summary UI
  document.getElementById('summaryDestination').textContent = destinationTitle;
  document.getElementById('summaryPackage').textContent = packageType;
  document.getElementById('summaryDate').textContent = formatDate(travelDate);
  document.getElementById('summaryTravelers').textContent =
    travelersCount + (travelersCount > 1 ? ' persons' : ' person');

  document.getElementById('basePrice').textContent = '₹' + totalPrice.toLocaleString('en-IN');
  document.getElementById('taxes').textContent = '₹' + taxes.toLocaleString('en-IN');
  document.getElementById('totalAmount').textContent = '₹' + grandTotal.toLocaleString('en-IN');
}

        
        function formatDate(dateString) {
            if (!dateString) return '-';
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-IN', options);
        }
        
        // Update localStorage with confirmed booking (called on successful payment)
function storeBookingInLocalStorage(ref, totalPrice) {
  const destination = document.getElementById('destinationSelect').value;
  const packageType = document.getElementById('packageType').value;
  const travelDate = document.getElementById('travelDate').value;
  const travelers = document.getElementById('travelersCount').value;

  const booking = {
    destination,
    packageType,
    travelDate,
    travelers,
    totalPrice,
    bookingRef: ref,
    timestamp: new Date().toISOString(),
    specialRequests: specialRequests.value.trim()
  };

  const existing = JSON.parse(localStorage.getItem('bookings') || '[]');
  existing.push(booking);
  localStorage.setItem('bookings', JSON.stringify(existing));
}

// ===================== Razorpay Payment Integration =====================
// PHASE 1: Validate and prepare (immediate)
function processPayment() {
  const termsChecked = document.getElementById('termsCheck').checked;
  if (!termsChecked) {
    showToast('Please accept the Terms & Conditions to proceed.', 'error');
    return;
  }

  const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
  const token = localStorage.getItem('token');
  if (!userInfo || !token) {
    showToast('You must be signed in to complete the booking.', 'error');
    return;
  }

  // Show loading immediately
  showToast('⏳ Processing your booking...', 'info');
  
  // Then do async work
  processPaymentAsync(userInfo, token);
}

// PHASE 2: Async work (booking + order creation)
async function processPaymentAsync(userInfo, token) {
  const destinationTitle = document.getElementById('destinationSelect').value;
  const destinations = JSON.parse(localStorage.getItem('destinations') || '[]');
  const destinationObj = destinations.find(
    dest => dest.title.trim().toLowerCase() === destinationTitle.trim().toLowerCase()
  );

  if (!destinationObj) {
    showToast('Selected destination not found in local data.', 'error');
    return;
  }

  const destinationId = destinationObj._id;
  const packageType = document.getElementById('packageType').value;
  const travelDate = document.getElementById('travelDate').value;
  const travelersCount = parseInt(document.getElementById('travelersCount').value);

  // 🔁 Fetch destination from backend using ID
  let selectedDestination;
  try {
    const res = await fetch(`${API_BASE}/destinations/${destinationId}`);
    if (!res.ok) throw new Error('Failed to fetch destination');
    selectedDestination = await res.json();
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('Failed to load destination details. Please try again.', 'error');
    return;
  }

  // ✅ Price calculation
  let basePrice = selectedDestination.price || 0;
  switch (packageType) {
    case 'Deluxe': basePrice *= 1.5; break;
    case 'Premium': basePrice *= 2; break;
  }
  const totalPrice = basePrice * travelersCount;
  const taxes = totalPrice * 0.05;
  const grandTotal = totalPrice + taxes;

  console.log('💰 Payment Calculation:', {
    basePrice,
    travelersCount,
    totalPrice,
    taxes,
    grandTotal
  });

  // Collect personal info
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const state = document.getElementById('state').value;
  const city = document.getElementById('city').value.trim();
  const pincode = document.getElementById('pincode').value.trim();
  const age = document.getElementById('age').value.trim();
  const gender = document.getElementById('gender').value;
  const specialRequests = document.getElementById('specialRequests').value.trim();

  // Travelers array
  const travelersArr = [{
    name: fullName,
    age,
    gender
  }];
  const additionalBlocks = document.querySelectorAll('#travelerInfoWrapper .traveler-block-additional');
  additionalBlocks.forEach(block => {
    const name = block.querySelector('input[name^="travelerName"]')?.value?.trim() || '-';
    const age = block.querySelector('input[name^="travelerAge"]')?.value?.trim() || '-';
    const gender = block.querySelector('select[name^="travelerGender"]')?.value || '-';
    travelersArr.push({ name, age, gender });
  });

  const personalInfo = { fullName, email, phone, state, city, pin: pincode };

  // Final booking payload
  const requestBody = {
    destinationId,
    packageType,
    travelers: travelersArr,
    personalInfo,
    travelDate,
    specialRequests
  };

  let bookingId = null; // Track for error handling

  try {
    // Step 1: Create booking
    const bookingRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(requestBody)
    });

    if (!bookingRes.ok) {
      const errorData = await bookingRes.json();
      throw new Error(errorData.message || 'Failed to create booking');
    }

    const booking = await bookingRes.json();
    bookingId = booking._id;
    
    console.log('✅ Booking created:', bookingId);
    showToast('✅ Booking created! Redirecting to payment...', 'success');
    
    // Step 2: Create Razorpay order
    const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        bookingId: bookingId,
        amount: grandTotal
      })
    });

    console.log('📦 Order response status:', orderRes.status);

    if (!orderRes.ok) {
      const errorData = await orderRes.json();
      console.error('❌ Order creation failed:', errorData);
      throw new Error(errorData.message || 'Failed to create payment order');
    }

    const orderData = await orderRes.json();
    console.log('✅ Order data received:', orderData);
    
    // Check if Razorpay is loaded
    if (typeof Razorpay === 'undefined') {
      console.error('❌ Razorpay script not loaded!');
      throw new Error('Razorpay payment gateway not available. Please refresh the page.');
    }
    
    // Step 3: Open Razorpay checkout
    const options = {
      key: orderData.data.keyId,
      amount: orderData.data.amount * 100, // Convert to paise
      currency: 'INR',
      name: 'Bharat Yatra',
      description: `Booking for ${destinationTitle}`,
      order_id: orderData.data.orderId,
      handler: async (response) => {
        // Step 4: Verify payment
        await verifyRazorpayPayment(response, bookingId, token, grandTotal);
      },
      prefill: {
        name: fullName || 'Guest',
        email: email || '',
        contact: phone || ''
      },
      notes: {
        bookingId: bookingId,
        destination: destinationTitle
      },
      theme: {
        color: '#FF9500'
      },
      modal: {
        ondismiss: async () => {
          showToast('Payment cancelled. You can try again.', 'error');
          // Notify backend of payment failure
          await notifyPaymentFailed(bookingId, token, 'User cancelled payment during checkout');
        }
      }
    };

    console.log('🔧 Detailed Razorpay options:', {
      key: options.key?.substring(0, 15) + '...',
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      order_id: options.order_id,
      prefill: options.prefill,
      notes: options.notes,
      theme: options.theme
    });

    // Check if key is undefined
    if (!options.key) {
      console.error('❌ CRITICAL: Razorpay KEY is undefined!');
      console.error('Full orderData:', orderData);
      throw new Error('Razorpay key not configured. Please check environment variables.');
    }

    // Debug: Check if Razorpay script loaded and has required methods
    if (typeof window.Razorpay !== 'function') {
      console.error('❌ Razorpay constructor not available!');
      console.error('window.Razorpay:', typeof window.Razorpay);
      throw new Error('Razorpay script not properly loaded. Try refreshing the page.');
    }

    console.log('🚀 Opening Razorpay modal on device:', {
      userAgent: navigator.userAgent,
      isMobile: /iPhone|iPad|Android/i.test(navigator.userAgent),
      isOnline: navigator.onLine,
      razorpayReady: razorpayReady,
      razorpayType: typeof window.Razorpay
    });

    // Auto-scroll to hero section first, then open payment popup there
    openRazorpayAfterHeroScroll(options);

  } catch (err) {
    console.error('Payment process error:', err);
    showToast('❌ Error: ' + err.message, 'error');
    
    // Notify backend of payment failure if booking was created
    if (bookingId && token) {
      notifyPaymentFailed(bookingId, token, `Payment initiation failed: ${err.message}`).catch(() => {
        // Silently fail if notification doesn't go through
      });
    }
  }
}
function openRazorpayModalDirectly(options) {
  try {
    console.log('🔴 [DIRECT CALL] Creating Razorpay instance...');
    console.log('📡 Razorpay key available:', !!options.key);
    console.log('📦 Order ID:', options.order_id);
    console.log('💵 Amount (paise):', options.amount);

    const scrollYBeforeCheckout = window.scrollY;
    
    const razorpay = new window.Razorpay(options);
    console.log('✅ Razorpay instance created');
    
    // Call open() immediately - still in "click" context
    razorpay.open();

    // Fallback: if Razorpay renders as a broken top strip, normalize to centered modal
    setTimeout(() => {
      normalizeRazorpayCheckoutLayout();
    }, 250);

    // Guard against browser/layout jump to top when checkout iframe is injected
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - scrollYBeforeCheckout) > 40) {
        window.scrollTo({ top: scrollYBeforeCheckout, behavior: 'auto' });
      }
    });
    console.log('✅ Razorpay modal opened successfully');

  } catch (err) {
    console.error('❌ Error opening Razorpay modal:', {
      message: err.message,
      code: err.code,
      razorpayAvailable: typeof window.Razorpay !== 'undefined',
      fullError: err
    });
    showToast('❌ Failed to open payment modal: ' + err.message, 'error');
  }
}

function openRazorpayAfterHeroScroll(options) {
  const heroSection = document.querySelector('.hero-slider')?.closest('section') || document.querySelector('section.relative.h-screen');

  if (!heroSection) {
    openRazorpayModalDirectly(options);
    return;
  }

  const targetTop = Math.max(0, Math.floor(heroSection.getBoundingClientRect().top + window.pageYOffset));
  const startTime = Date.now();
  const maxWait = 1800;

  window.scrollTo({ top: targetTop, behavior: 'smooth' });

  const poll = () => {
    const closeToTarget = Math.abs(window.scrollY - targetTop) <= 8;
    const timedOut = Date.now() - startTime >= maxWait;

    if (closeToTarget) {
      setTimeout(() => openRazorpayModalDirectly(options), 80);
      return;
    }

    if (timedOut) {
      window.scrollTo({ top: targetTop, behavior: 'auto' });
      setTimeout(() => openRazorpayModalDirectly(options), 80);
      return;
    }

    requestAnimationFrame(poll);
  };

  requestAnimationFrame(poll);
}

function normalizeRazorpayCheckoutLayout() {
  if (window.innerWidth < 768) return;

  const frame = document.querySelector('iframe[name*="razorpay-checkout-frame"]');
  if (!frame) return;

  const rect = frame.getBoundingClientRect();
  const looksLikeTopStrip =
    rect.top <= 16 &&
    rect.width >= window.innerWidth * 0.9 &&
    rect.height > 0 &&
    rect.height <= 260;

  if (!looksLikeTopStrip) return;

  const modalWidth = Math.min(520, window.innerWidth - 32);
  const modalHeight = Math.min(720, Math.floor(window.innerHeight * 0.9));

  frame.style.setProperty('position', 'fixed', 'important');
  frame.style.setProperty('top', '50%', 'important');
  frame.style.setProperty('left', '50%', 'important');
  frame.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
  frame.style.setProperty('width', `${modalWidth}px`, 'important');
  frame.style.setProperty('height', `${modalHeight}px`, 'important');
  frame.style.setProperty('max-width', 'calc(100vw - 32px)', 'important');
  frame.style.setProperty('max-height', '90vh', 'important');
  frame.style.setProperty('z-index', '2147483647', 'important');

  const backdrop = document.querySelector('.razorpay-backdrop');
  if (backdrop) {
    backdrop.style.setProperty('position', 'fixed', 'important');
    backdrop.style.setProperty('inset', '0', 'important');
    backdrop.style.setProperty('z-index', '2147483646', 'important');
  }

  console.warn('⚠️ Razorpay frame rendered as top strip; applied centered fallback layout.');
}

// Helper function to open Razorpay modal (legacy - keeping for backward compat)
function openRazorpayModal(options, successCallback, errorCallback) {
  try {
    const razorpay = new window.Razorpay(options);
    console.log('✅ Razorpay instance created successfully');
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      try {
        razorpay.open();
        console.log('✅ Razorpay modal display()  called');
      } catch (openErr) {
        console.error('❌ Error calling razorpay.open():', openErr);
        showToast('❌ Payment modal failed to open: ' + openErr.message, 'error');
        errorCallback(openErr);
      }
    }, 100);
    
  } catch (razorpayErr) {
    console.error('❌ Razorpay constructor error:', {
      message: razorpayErr.message,
      stack: razorpayErr.stack,
      razorpayExists: typeof window.Razorpay
    });
    showToast('❌ Payment system error: ' + razorpayErr.message, 'error');
    errorCallback(razorpayErr);
  }
}

// Notify backend of payment failure and trigger email
async function notifyPaymentFailed(bookingId, token, reason = 'Payment cancelled') {
  try {
    const response = await fetch(`${API_BASE}/payments/payment-failed`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        bookingId: bookingId,
        reason: reason
      })
    });

    const data = await response.json();
    if (data.success) {
      console.log('✅ Payment failure notification sent to user');
    } else {
      console.warn('⚠️ Failed to notify payment failure:', data.message);
    }
  } catch (error) {
    console.error('❌ Error notifying payment failure:', error.message);
  }
}

// Verify Razorpay payment
async function verifyRazorpayPayment(response, bookingId, token, grandTotal) {
  try {
    const verifyRes = await fetch(`${API_BASE}/payments/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
        bookingId: bookingId
      })
    });

    const data = await verifyRes.json();

    if (data.success) {
      showToast('✅ Payment Successful! Thank you for booking with us.', 'success');
      
      // Get booking reference for display
      const bookingRefRes = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (bookingRefRes.ok) {
        const bookingData = await bookingRefRes.json();
        document.getElementById('bookingRef').textContent = bookingData.bookingRef;
      }

      document.getElementById('paymentModal').classList.remove('hidden');

      // Reset form after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);

    } else {
      showToast('❌ Payment verification failed: ' + data.message, 'error');
    }

  } catch (error) {
    console.error('Verification error:', error);
    showToast('❌ Payment verification failed', 'error');
  }
}



// Scroll to the loading screen animation automatically on page load
document.addEventListener('DOMContentLoaded', function () {
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModal = document.getElementById('logoutModal');
  const logoutDialog = document.getElementById('logoutDialog');
  const cancelLogout = document.getElementById('cancelLogout');
  const confirmLogout = document.getElementById('confirmLogout');

  if (logoutBtn && logoutModal && logoutDialog && cancelLogout && confirmLogout) {
    // 👇 Add click event without cloning or replacing button
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.add('overflow-hidden');
      logoutModal.classList.remove('hidden');
      logoutDialog.classList.remove('scale-95');
      logoutDialog.classList.add('scale-100');
      setTimeout(function () {
        logoutDialog.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });

    cancelLogout.addEventListener('click', function () {
      document.body.classList.remove('overflow-hidden');
      logoutModal.classList.add('hidden');
      logoutDialog.classList.add('scale-95');
      logoutDialog.classList.remove('scale-100');
    });

    confirmLogout.addEventListener('click', function () {
      localStorage.removeItem('userInfo');   // ✅ FIXED: remove correct key
      localStorage.removeItem('token');      // ✅ Clear auth token too

      if (typeof showToast === 'function') showToast('Logged out successfully!');

      logoutModal.classList.add('hidden');
      setTimeout(function () {
        window.location.href = '/index.html'; // ✅ Redirect after logout
      }, 1200);
    });
  }
});

        
        // Close modal
        function closeModal() {
            document.getElementById('paymentModal').classList.add('hidden');
            
            // Reset form
            document.getElementById('step1').classList.remove('hidden');
            document.getElementById('step2').classList.add('hidden');
            document.getElementById('step3').classList.add('hidden');
            
            // Reset progress steps
            document.querySelectorAll('.step').forEach((step, index) => {
                const circle = step.querySelector('div');
                if (index === 0) {
                    circle.classList.remove('bg-gray-300', 'text-gray-600');
                    circle.classList.add('bg-orange-500', 'text-white');
                } else {
                    circle.classList.add('bg-gray-300', 'text-gray-600');
                    circle.classList.remove('bg-orange-500', 'text-white');
                }
            });
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Quick booking from destination cards
        function startBooking(destination, price) {
  const select = document.getElementById('destinationSelect');

  // Try to find the destination option and select it
  const options = Array.from(select.options);
  const match = options.find(opt => opt.value.trim().toLowerCase() === destination.trim().toLowerCase());

  if (match) {
    select.value = match.value;
  } else {
    // If not present, dynamically add the destination
    const newOption = document.createElement('option');
    newOption.value = destination;
    newOption.textContent = destination;
    select.appendChild(newOption);
    select.value = destination;
  }

  // Set tomorrow as default date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = tomorrow.toISOString().split('T')[0];
  document.getElementById('travelDate').value = formattedDate;

  updateBookingSummary();
  document.getElementById('bookingForm').scrollIntoView({ behavior: 'smooth' });
}

        // Initialize date picker with min date as tomorrow
        window.onload = function() {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const formattedDate = tomorrow.toISOString().split('T')[0];
            document.getElementById('travelDate').min = formattedDate;
            
            // Initialize slider
            initSlider();
        };

        // Slider functionality
        function initSlider() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slider-dot');
    const prevBtn = document.getElementById('prevSlideBtn');
    const nextBtn = document.getElementById('nextSlideBtn');
    let currentSlide = 0;
    let autoSlideInterval;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.style.opacity = i === index ? '1' : '0';
            slide.style.zIndex = i === index ? '1' : '0';
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('bg-white', i === index);
            dot.classList.toggle('bg-opacity-50', i !== index);
        });
        currentSlide = index;
    }

    function changeSlide(step) {
        let newIndex = (currentSlide + step + slides.length) % slides.length;
        showSlide(newIndex);
    }

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            changeSlide(1);
        }, 5000); // Change slide every 5 seconds
    }

    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }

    // Initial display
    showSlide(currentSlide);
    startAutoSlide();

    // Arrow navigation
    prevBtn.addEventListener('click', () => {
        stopAutoSlide();
        changeSlide(-1);
        startAutoSlide();
    });

    nextBtn.addEventListener('click', () => {
        stopAutoSlide();
        changeSlide(1);
        startAutoSlide();
    });

    // Dot navigation
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            stopAutoSlide();
            showSlide(i);
            startAutoSlide();
        });
    });
}

        // ===================== Testimonial Slider =====================
        // Testimonial slider logic: 3 at a time, autoplay, prev/next
        (function() {
            const slider = document.getElementById('testimonialSlider');
            const slidesContainer = document.getElementById('testimonialSlides');
            const boxes = slidesContainer.querySelectorAll('.testimonial-box');
            const prevBtn = document.getElementById('testimonialPrev');
            const nextBtn = document.getElementById('testimonialNext');
            const total = boxes.length;
            const visible = 3;
            let current = 0;
            let autoInterval;

            function updateSlider() {
                const slideWidth = boxes[0].offsetWidth + 16; // box + margin
                slidesContainer.style.transform = `translateX(-${current * slideWidth}px)`;
            }

            function nextSlide() {
                if (current + visible >= total) {
                    current = 0;
                } else {
                    current += visible;
                    if (current + visible > total) current = total - visible;
                }
                updateSlider();
            }

            function prevSlide() {
                if (current === 0) {
                    current = total - visible;
                } else {
                    current -= visible;
                    if (current < 0) current = 0;
                }
                updateSlider();
            }

            function startAuto() {
                autoInterval = setInterval(nextSlide, 3500);
            }
            function stopAuto() {
                clearInterval(autoInterval);
            }

            nextBtn.addEventListener('click', () => { stopAuto(); nextSlide(); startAuto(); });
            prevBtn.addEventListener('click', () => { stopAuto(); prevSlide(); startAuto(); });
            slider.addEventListener('mouseenter', stopAuto);
            slider.addEventListener('mouseleave', startAuto);

            window.addEventListener('resize', updateSlider);
            updateSlider();
            startAuto();

            // Mouse wheel horizontal scroll for testimonials
            slider.addEventListener('wheel', function(e) {
                if (!e.shiftKey) {
                    e.preventDefault();
                    slider.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        })();

        // ===================== Review System =====================

// Global Star rating logic (refactored outside)
function highlightStars(starCount) {
  const reviewStars = document.getElementById('reviewStars');
  if (!reviewStars) return;
  Array.from(reviewStars.children).forEach((star, idx) => {
    if (idx < starCount) {
      star.classList.add('text-yellow-400');
      star.classList.remove('text-gray-300');
    } else {
      star.classList.remove('text-yellow-400');
      star.classList.add('text-gray-300');
    }
  });
}

// Star interaction setup
const reviewStars = document.getElementById('reviewStars');
const reviewRating = document.getElementById('reviewRating');
if (reviewStars && reviewRating) {
  reviewStars.addEventListener('mouseover', function (e) {
    if (e.target.dataset.star) {
      highlightStars(e.target.dataset.star);
    }
  });
  reviewStars.addEventListener('mouseout', function () {
    highlightStars(reviewRating.value);
  });
  reviewStars.addEventListener('click', function (e) {
    if (e.target.dataset.star) {
      reviewRating.value = e.target.dataset.star;
      highlightStars(e.target.dataset.star);
    }
  });
}


function showUserReviewInfo() {
  const user = JSON.parse(localStorage.getItem("userInfo") || "null");

  const infoBox = document.getElementById("userReviewInfo");
  const avatarEl = document.getElementById("reviewUserAvatar");  // ✅ Updated ID
  const nameSpan = document.getElementById("reviewUserName");    // ✅ Updated ID
  const loginPrompt = document.getElementById("loginPrompt");

  if (user && user.name) {
    const avatarUrl = getAvatarUrl(user);
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=F59E42&color=fff&rounded=true`;

    if (avatarEl) {
      avatarEl.onerror = function () {
        this.onerror = null;
        this.src = fallback;
      };
      avatarEl.src = avatarUrl;
    }

    if (nameSpan) nameSpan.textContent = user.name;

    infoBox?.classList.remove("hidden");
    loginPrompt?.classList.add("hidden");
  } else {
    loginPrompt?.classList.remove("hidden");
    infoBox?.classList.add("hidden");
  }
}







// Call this on page load
document.addEventListener("DOMContentLoaded", showUserReviewInfo);

// ===================== Handle Review Form Submission =====================
const reviewForm = document.getElementById("reviewForm");
const token = localStorage.getItem("token");
const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");

if (reviewForm) {
  reviewForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();

    if (!token || !userInfo) {
      showToast("Please log in to submit a review", "error");
      return;
    }

    if (!rating || !comment) {
      showToast("Please provide both a rating and a comment", "warning");
      return;
    }

    const destinations = JSON.parse(localStorage.getItem("destinations") || "[]");
    const selectedTitle = localStorage.getItem("selectedDestinationTitle");

    if (!selectedTitle) {
      showToast("No destination selected. Please click 'Rate Now' on a destination.", "error");
      return;
    }

    const destination = destinations.find(d => d.title === selectedTitle);
    if (!destination) {
      showToast("Destination not found", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          destinationId: destination._id,
          rating,
          comment
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit review");
      }

      const review = await res.json();

      await loadAllDynamicReviews();



      reviewForm.reset();
      highlightStars(0);
      document.getElementById('reviewRating').value = 0;
      showToast("✅ Thank you for your review!", "success");

      // Optionally clear selected destination after submit:
      // localStorage.removeItem("selectedDestinationTitle");
      // localStorage.removeItem("selectedDestinationId");
      // document.getElementById("selectedDestinationDisplay").textContent = "";

    } catch (err) {
      console.error("Review submit error:", err);
      showToast("❌ " + err.message, "error");
    }
  });
}


// ===================== Add Testimonial to Slider =====================
function addTestimonial(name, rating, comment, skipScroll, avatarUrl = '') {
  const slidesContainer = document.getElementById('testimonialSlides');
  if (!slidesContainer) return;

  const initials = getInitials(name);
  const fallback = `<div class="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold mr-4">${initials}</div>`;
  const avatar = avatarUrl
    ? `<img src="${avatarUrl}" alt="${name}" class="w-12 h-12 rounded-full object-cover mr-4 border border-orange-300">`
    : fallback;

  const box = document.createElement('div');
  box.className = 'testimonial-box bg-gray-50 p-6 rounded-lg shadow-sm mx-2 min-w-[320px] max-w-[350px] flex-1';

  box.innerHTML = `
    <div class="flex items-center mb-4">
      ${avatar}
      <div>
        <h4 class="font-bold">${escapeHtml(name)}</h4>
        <div class="flex text-yellow-400">
          ${'<i class="fas fa-star"></i>'.repeat(rating)}${'<i class="fas fa-star text-gray-300"></i>'.repeat(5 - rating)}
        </div>
      </div>
    </div>
    <p class="text-gray-600">"${escapeHtml(comment)}"</p>
  `;
  slidesContainer.appendChild(box);
  if (!skipScroll) {
    box.scrollIntoView({ behavior: 'smooth', inline: 'center' });
  }
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

        // ===================== User Menu Logic =====================
        const userMenu = document.getElementById('userMenu');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        // Use the already declared authBtn from above
        const dropdownName = document.getElementById('dropdownName');
        const dropdownEmail = document.getElementById('dropdownEmail');
        const userAvatar = document.getElementById('userAvatar');
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        const logoutBtn = document.getElementById('logoutBtn');

        function showUserMenu(user) {
    if (!user) return;

    // Set name, email
    dropdownName.textContent = user.name;
    dropdownEmail.textContent = user.email;

    const avatarUrl = user.profileImage
  ? (user.profileImage.startsWith('http')
      ? `${user.profileImage}?t=${Date.now()}`
      : `${UPLOADS_BASE}${user.profileImage.replace(/\\/g, '/')}?t=${Date.now()}`)
  : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=F59E42&color=fff&rounded=true`;

userAvatar.src = avatarUrl;
dropdownAvatar.src = avatarUrl;


    userMenu.classList.remove('hidden');
    authBtn.classList.add('hidden');
}

function hideUserMenu() {
    userMenu.classList.add('hidden');
    authBtn.classList.remove('hidden');
    showToast('Logged out successfully.', 'success');
}

// Toggle dropdown menu
if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', function(e) {
        if (!userDropdown.classList.contains('hidden')) {
            userDropdown.classList.add('hidden');
        }
    });
}

// ✅ On page load, show menu if user is logged in
window.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('userInfo') || 'null');
    if (user) showUserMenu(user);
});

        // ===================== Auth Modal Logic =====================
        // Show modal
        const authBtn = document.getElementById('authBtn');
        const authModal = document.getElementById('authModal');
        const closeAuthModal = document.getElementById('closeAuthModal');
        const signInTab = document.getElementById('signInTab');
        const signUpTab = document.getElementById('signUpTab');
        const signInForm = document.getElementById('signInForm');
        const signUpForm = document.getElementById('signUpForm');

        if (authBtn && authModal && closeAuthModal) {
            authBtn.addEventListener('click', () => {
                authModal.classList.remove('hidden');
                // Center modal in viewport, do not scroll page
                authModal.scrollIntoView({ behavior: 'auto', block: 'center' });
                // Prevent background scroll
                document.body.style.overflow = 'hidden';
            });
            closeAuthModal.addEventListener('click', () => {
                authModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
            window.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    authModal.classList.add('hidden');
                    document.body.style.overflow = '';
                }
            });
        }
        // Tab switching
        if (signInTab && signUpTab && signInForm && signUpForm) {
            signInTab.addEventListener('click', () => {
                signInTab.classList.add('text-orange-500', 'border-b-2', 'border-orange-500');
                signInTab.classList.remove('text-gray-500', 'border-transparent');
                signUpTab.classList.remove('text-orange-500', 'border-b-2', 'border-orange-500');
                signUpTab.classList.add('text-gray-500', 'border-transparent');
                signInForm.classList.remove('hidden');
                signUpForm.classList.add('hidden');
            });
            signUpTab.addEventListener('click', () => {
                signUpTab.classList.add('text-orange-500', 'border-b-2', 'border-orange-500');
                signUpTab.classList.remove('text-gray-500', 'border-transparent');
                signInTab.classList.remove('text-orange-500', 'border-b-2', 'border-orange-500');
                signInTab.classList.add('text-gray-500', 'border-transparent');
                signUpForm.classList.remove('hidden');
                signInForm.classList.add('hidden');
            });
        }
        // Simple validation and demo storage (localStorage)
        if (signUpForm) {
  signUpForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = document.getElementById('signUpName').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;

    if (!name || !email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Sign up successful! You can now sign in.', 'success');
        signUpForm.reset();
        signInTab.click();
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Server error. Try again later.', 'error');
    }
  });
}

       if (signInForm) {
  signInForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value.trim();


    if (!email || !password) {
      showSignInToast('Please fill all fields.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));

        showUserMenu(data.user);
        authModal.classList.add('hidden');
        document.body.style.overflow = '';
        showSignInToast('Login successful!', 'success');

        if (data.user.isAdmin) {
          window.location.href = ADMIN_URL;
        } else {
          window.location.href = `/index.html`; // or reload if user
        }
      } else {
        showSignInToast(data.message || 'Login failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showSignInToast('Server error. Try again.', 'error');
    }
  });
}

        // ===================== Sign Up Validation and View Password =====================
        const signUpEmail = document.getElementById('signUpEmail');
        const signUpPassword = document.getElementById('signUpPassword');
        const toggleSignUpPassword = document.getElementById('toggleSignUpPassword');
        const passwordStrengthMsg = document.getElementById('passwordStrengthMsg');

        // Email validation regex
        function isValidEmail(email) {
            return /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/.test(email);
        }
        // Password strength check
        function isStrongPassword(password) {
            // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
        }
        // Show/hide password
        if (toggleSignUpPassword && signUpPassword) {
            toggleSignUpPassword.addEventListener('click', function() {
                if (signUpPassword.type === 'password') {
                    signUpPassword.type = 'text';
                    toggleSignUpPassword.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    signUpPassword.type = 'password';
                    toggleSignUpPassword.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        }
        // Password strength feedback
        if (signUpPassword && passwordStrengthMsg) {
            signUpPassword.addEventListener('input', function() {
                if (!signUpPassword.value) {
                    passwordStrengthMsg.textContent = '';
                } else if (isStrongPassword(signUpPassword.value)) {
                    passwordStrengthMsg.textContent = 'Strong password';
                    passwordStrengthMsg.className = 'text-xs mt-1 text-green-600';
                } else {
                    passwordStrengthMsg.textContent = 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.';
                    passwordStrengthMsg.className = 'text-xs mt-1 text-red-500';
                }
            });
        }
        // Sign up form validation
        if (signUpForm) {
            signUpForm.addEventListener('submit', function(e) {
                const email = signUpEmail.value.trim();
                const password = signUpPassword.value;
                if (!isValidEmail(email)) {
                    e.preventDefault();
                    alert('Please enter a valid email address.');
                    signUpEmail.focus();
                    return;
                }
                if (!isStrongPassword(password)) {
                    e.preventDefault();
                    alert('Please enter a strong password.');
                    signUpPassword.focus();
                    return;
                }
            }, true);
        }
        // ===================== Sign In View Password =====================
        const signInPassword = document.getElementById('signInPassword');
        const toggleSignInPassword = document.getElementById('toggleSignInPassword');
        if (toggleSignInPassword && signInPassword) {
            toggleSignInPassword.addEventListener('click', function() {
                if (signInPassword.type === 'password') {
                    signInPassword.type = 'text';
                    toggleSignInPassword.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    signInPassword.type = 'password';
                    toggleSignInPassword.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        }
        // ===================== Animated Auth Modal Entrance =====================
        (function() {
            const authModal = document.getElementById('authModal');
            if (!authModal) return;
            // Add animation classes on show/hide
            function showModal() {
                authModal.classList.remove('hidden');
                authModal.classList.remove('fadeOutUp');
                authModal.classList.add('fadeInDown');
                // Prevent background scroll
                document.body.style.overflow = 'hidden';
            }
            function hideModal() {
                authModal.classList.remove('fadeInDown');
                authModal.classList.add('fadeOutUp');
                setTimeout(() => {
                    authModal.classList.add('hidden');
                    document.body.style.overflow = '';
                }, 350);
            }
            // Replace default show/hide logic
            const authBtn = document.getElementById('authBtn');
            const closeAuthModal = document.getElementById('closeAuthModal');
            if (authBtn && closeAuthModal) {
                authBtn.addEventListener('click', showModal);
                closeAuthModal.addEventListener('click', hideModal);
                window.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && !authModal.classList.contains('hidden')) hideModal();
                });
            }
        })();
        // ===================== Ripple Effect for Book Now Buttons =====================
        (function() {
          document.querySelectorAll('.destination-card .ripple-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
              const rect = btn.getBoundingClientRect();
              const ripple = document.createElement('span');
              ripple.className = 'ripple';
              const size = Math.max(rect.width, rect.height);
              ripple.style.width = ripple.style.height = size + 'px';
              ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
              ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
              btn.appendChild(ripple);
              setTimeout(() => ripple.remove(), 500);
            });
          });
        })();
        // ===================== Toast Notifications =====================
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast pointer-events-auto px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 text-white font-semibold text-base animate-toast-in ${type === 'error' ? 'bg-red-500' : 'bg-orange-500'}`;
  toast.innerHTML = `
    <span>${type === 'error' ? '<i class=\'fas fa-times-circle mr-2\'></i>' : '<i class=\'fas fa-check-circle mr-2\'></i>'}${message}</span>
    <button class="ml-4 text-white/80 hover:text-white focus:outline-none" style="font-size:1.2em;" aria-label="Close">&times;</button>
  `;
  toast.querySelector('button').onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('animate-toast-out'); setTimeout(() => toast.remove(), 400); }, duration);
}
// Toast animation
const style = document.createElement('style');
style.innerHTML = `
@keyframes toast-in { from { opacity:0; transform:translateY(-30px) scale(0.95);} to {opacity:1; transform:none;} }
@keyframes toast-out { from {opacity:1;} to {opacity:0; transform:translateY(-30px) scale(0.95);} }
.toast.animate-toast-in { animation: toast-in 0.4s cubic-bezier(.4,2,.6,1) both; }
.toast.animate-toast-out { animation: toast-out 0.4s cubic-bezier(.4,2,.6,1) both; }
`;
document.head.appendChild(style);
// ===================== Toast Notifications (Sign-In Form Inline) =====================
function showSignInToast(message, type = 'success', duration = 3000) {
  const area = document.getElementById('signInToastArea');
  if (!area) return;
  area.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `w-full mb-3 px-4 py-2 rounded-lg flex items-center text-sm font-semibold ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
  toast.innerHTML = `${type === 'error' ? '<i class=\'fas fa-times-circle mr-2\'></i>' : '<i class=\'fas fa-check-circle mr-2\'></i>'}${message}`;
  area.appendChild(toast);
  setTimeout(() => { if (area.contains(toast)) toast.remove(); }, duration);
}
// Patch sign-in form to use inline toast
if (signInForm) {
  signInForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value.trim();

    if (!email || !password) {
      showSignInToast('Please fill all fields.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userInfo', JSON.stringify(data.user));

        showUserMenu(data.user);
        authModal.classList.add('hidden');
        document.body.style.overflow = '';

        setTimeout(() => {
          showToast(`Welcome, ${data.user.name}!`, 'success');
          userAvatar.classList.add('avatar-bounce');
          setTimeout(() => userAvatar.classList.remove('avatar-bounce'), 500);
        }, 300);

        if (data.user.isAdmin) {
          window.location.href = ADMIN_URL;
        } else {
          window.location.href = `/index.html`; // or reload if user
        }

      } else {
        showSignInToast(data.message || 'Login failed.', 'error');
      }
    } catch (err) {
      console.error('Login error:', err);
      showSignInToast('Server error. Try again.', 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
    const travelersInput = document.getElementById('travelersCount');
    const addTravelerBtn = document.getElementById('addTravelerBtn');
    const wrapper = document.getElementById('travelerInfoWrapper');
    let travelerCounter = 1;

    travelersInput.addEventListener('input', () => {
        const count = parseInt(travelersInput.value);
        travelerCounter = 1;
        document.querySelectorAll('.traveler-block-additional').forEach(el => el.remove());
        addTravelerBtn.classList.toggle('hidden', isNaN(count) || count <= 1);
        if (!isNaN(count) && count > 1) {
            addTravelerBtn.textContent = `+ Add Traveler 2`;
        }
    });

    addTravelerBtn.addEventListener('click', () => {
        addTravelerBtn.textContent = `+ Add Traveler ${travelerCounter + 1}`;
        const maxTravelers = parseInt(travelersInput.value);
        if (isNaN(maxTravelers) || travelerCounter >= maxTravelers) return;
        travelerCounter++;

        const block = document.createElement('div');
        block.className = 'grid grid-cols-1 md:grid-cols-2 gap-6 traveler-block-additional mt-6 border-t pt-6';
        block.innerHTML = `
            <div>
                <label class="block text-gray-700 font-medium mb-2">Traveler ${travelerCounter} Name <span class="text-red-500">*</span></label>
                <input type="text" name="travelerName${travelerCounter}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Enter name">
            </div>
            <div>
                <label class="block text-gray-700 font-medium mb-2">Traveler ${travelerCounter} Age <span class="text-red-500">*</span></label>
                <input type="number" name="travelerAge${travelerCounter}" min="1" inputmode="numeric" pattern="[0-9]*" onwheel="this.blur()" min="1" inputmode="numeric" pattern="[0-9]*" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Enter age">
            </div>
            <div>
                <label class="block text-gray-700 font-medium mb-2">Traveler ${travelerCounter} Gender <span class="text-red-500">*</span></label>
                <select name="travelerGender${travelerCounter}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
            </div>
        `;
        wrapper.appendChild(block);

        if (travelerCounter >= maxTravelers) {
            addTravelerBtn.classList.add('hidden');
        } else {
            addTravelerBtn.textContent = `+ Add Traveler ${travelerCounter + 1}`;
        }
    });
});

window.prevStep = function(currentStep) {
    const current = document.getElementById(`step${currentStep}`);
    const previous = document.getElementById(`step${currentStep - 1}`);
    if (current && previous) {
        const scrollPos = window.scrollY;
        current.classList.add('hidden');
        previous.classList.remove('hidden');
        setTimeout(() => window.scrollTo({ top: scrollPos, behavior: 'instant' }), 0);
    }
};

const originalNextStep = window.nextStep || function() {};
window.nextStep = function(currentStep) {
    const summary = document.getElementById('travelerSummary');
    if (summary) summary.innerHTML = '';

    // 👥 When moving FROM step 1 TO step 2, show Add Traveler button if needed
    if (currentStep === 1) {
        const travelersCount = parseInt(document.getElementById('travelersCount')?.value || '1');
        const addTravelerBtn = document.getElementById('addTravelerBtn');
        if (addTravelerBtn) {
            if (travelersCount > 1) {
                addTravelerBtn.classList.remove('hidden');
                addTravelerBtn.textContent = `+ Add Traveler 2`;
            } else {
                addTravelerBtn.classList.add('hidden');
            }
        }
    }

    if (currentStep === 2) {
        const total = parseInt(document.getElementById('travelersCount')?.value || '1');
        if (total > 1) {
            const wrapper = document.getElementById('travelerInfoWrapper');
            const blocks = wrapper.querySelectorAll('.traveler-block-additional');

            if (blocks.length < total - 1) {
               showToast(`Please add details for all ${total - 1} additional traveler(s).`, 'warning');

                return;
            }

            let allFilled = true;
            for (let i = 0; i < total - 1; i++) {
                const block = blocks[i];
                const name = block.querySelector(`input[name=travelerName${i + 2}]`);
                const age = block.querySelector(`input[name=travelerAge${i + 2}]`);
                const gender = block.querySelector(`select[name=travelerGender${i + 2}]`);

                [name, age, gender].forEach(field => field?.classList.remove('border-red-500'));

                if (!name?.value.trim() || !age?.value.trim() || !gender?.value.trim()) {
                    allFilled = false;
                    [name, age, gender].forEach(field => {
                        if (!field?.value.trim()) field.classList.add('border-red-500');
                    });
                }
            }
            if (!allFilled) return;
        }

        const blocks = document.querySelectorAll('#travelerInfoWrapper .traveler-block-additional');
        const firstTraveler = {
            name: document.getElementById('fullName')?.value?.trim() || '-',
            age: document.getElementById('age')?.value?.trim() || '-',
            gender: document.getElementById('gender')?.value?.trim() || '-'
        };
        if (summary) {
            summary.innerHTML = '<h3 class="text-lg font-semibold mb-2">Traveler Summary:</h3>';
        summary.innerHTML += `<p class="mb-1">Traveler 1: <strong>${firstTraveler.name}</strong>, Age: ${firstTraveler.age}, Gender: ${firstTraveler.gender}</p>`;
            blocks.forEach((block, index) => {
            const name = block.querySelector('input[name^="travelerName"]')?.value?.trim() || '-';
            const age = block.querySelector('input[name^="travelerAge"]')?.value?.trim() || '-';
            const gender = block.querySelector('select[name^="travelerGender"]')?.value?.trim() || '-';
            summary.innerHTML += `<p class="mb-1">Traveler ${index + 2}: <strong>${name}</strong>, Age: ${age}, Gender: ${gender}</p>`;
        });
        }
    }

    if (typeof originalNextStep === 'function') originalNextStep(currentStep);
};
window.addEventListener('load', function () {
  const loader = document.getElementById('loadingScreen');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 1500); // Optional delay (1.5s)
  }
});
document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("toggleDestinationsBtn");
    const toggleText = document.getElementById("toggleText");

    let isExpanded = false;

    button.addEventListener("click", () => {
      isExpanded = !isExpanded;
      toggleText.textContent = isExpanded ? "See Less" : "See More";
    });
  });
  async function handleLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) {
      // Store token and user info
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("loggedInUser", JSON.stringify(data.user));

      showToast("Login successful!", "success");

      // Redirect based on role
      if (data.user.isAdmin) {
        window.location.href = ADMIN_URL;
      } else {
        location.reload(); // or navigate to profile.html
      }

    } else {
      showToast(data.message || "Login failed", "error");
    }

  } catch (err) {
    showToast("Error logging in", "error");
    console.error(err);
  }
}

