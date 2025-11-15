/**
 * Loading indicator UI module
 */

// Loading overlay element reference
let loadingOverlay: HTMLDivElement | null = null;

/**
 * Show loading indicator with message
 *
 * @param message - Loading message to display
 */
export function showLoading(message = "Loading..."): void {
  // Create overlay if it doesn't exist
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner"></div>
        <p class="loading-message"></p>
      </div>
    `;

    // Add styles
    const style = document.createElement("style");
    style.textContent = `
      #loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }

      .loading-content {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .spinner {
        width: 40px;
        height: 40px;
        margin: 0 auto 1rem;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-message {
        margin: 0;
        color: #333;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }

  // Update message
  const messageElement = loadingOverlay.querySelector(".loading-message");
  if (messageElement) {
    messageElement.textContent = message;
  }

  // Add to DOM if not already present
  if (!document.body.contains(loadingOverlay)) {
    document.body.appendChild(loadingOverlay);
  }
}

/**
 * Hide loading indicator
 */
export function hideLoading(): void {
  if (loadingOverlay && document.body.contains(loadingOverlay)) {
    document.body.removeChild(loadingOverlay);
  }
}
