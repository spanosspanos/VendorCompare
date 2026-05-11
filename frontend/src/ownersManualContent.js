// VendorCompare Owner's Manual v1.1 — structured sections for in-app display
const manualSections = [
  {
    id: 1,
    title: "1. Introduction",
    subsections: [
      {
        id: "1.1",
        title: "1.1 What Is VendorCompare?",
        body: `VendorCompare is a procurement management tool built specifically for restaurant kitchens. It replaces ad-hoc ordering processes — handwritten lists, informal calls to vendors, and guesswork about who has the best price — with a structured, transparent workflow that any kitchen team can follow consistently.

At its core, VendorCompare does three things:
• It helps kitchen staff build accurate orders, either by browsing a product catalog (Quick Order) or by conducting a formal inventory count against established PAR levels (Inventory Count).
• It automatically splits orders across vendors to ensure the kitchen is ordering each item from the most cost-effective source available.
• It routes every order to the Owner or Administrator for review and approval before anything is sent, keeping the decision-maker in control of purchasing spend.`,
      },
      {
        id: "1.2",
        title: "1.2 Who Is This Tool For?",
        body: `Kitchen Staff interact with the system daily. They use it to record what the kitchen needs, review the assembled order, flag questions or concerns for the owner, and submit orders for approval. The interface is designed to be fast and intuitive — kitchen staff should be able to complete a typical order in a few minutes.

The Owner and Administrator use the system to oversee all purchasing activity. They review submitted orders, approve or adjust them, manage vendors and product listings, set PAR levels, maintain the employee roster, and archive historical orders for cost tracking.`,
      },
      {
        id: "1.3",
        title: "1.3 Philosophy",
        body: `VendorCompare is built on a simple premise: the person spending the money should see the order before it goes out. By introducing a lightweight approval step between the kitchen floor and the vendor, the system creates accountability without creating bureaucracy. Staff can still move quickly; the owner retains visibility and control.

The tool is also designed for longevity. Vendor pricing changes, staff turns over, and PAR levels need periodic adjustment. VendorCompare is built to accommodate those realities — vendors can be muted or removed without disrupting the product catalog, employee records are easy to update, and PAR values can be tuned at any time.`,
      },
    ],
  },
  {
    id: 2,
    title: "2. System Requirements",
    subsections: [
      {
        id: "2.1",
        title: "2.1 Supported Deployment Environments",
        body: `VendorCompare runs as a containerized web application. It can be hosted on local hardware within the restaurant network or on a remote virtual private server (VPS). Both options are fully supported.`,
      },
      {
        id: "2.2",
        title: "2.2 Hardware Requirements",
        body: `Local hardware: minimum 2-core CPU, 2 GB RAM, 20 GB storage. Recommended: 4-core CPU, 4 GB RAM, 50 GB SSD.
VPS: minimum 1 vCPU, 1 GB RAM, 10 GB storage. Recommended: 2 vCPU, 2 GB RAM, 20 GB SSD.
Client devices: any device with a modern browser. Tablet or desktop with stable network recommended.

VendorCompare's database is SQLite, which is file-based and does not require a separate database server.`,
      },
      {
        id: "2.3",
        title: "2.3 Software Requirements",
        body: `The following software must be installed on the host machine before deploying VendorCompare:
• Docker Engine (version 20.10 or later) and Docker Compose (version 2.0 or later)
• Caddy (version 2.x) — used as the reverse proxy and automatic TLS provider
• A registered domain name or subdomain pointed at the host server's public IP address (required for HTTPS via Caddy)`,
      },
      {
        id: "2.4",
        title: "2.4 Client / Browser Requirements",
        body: `VendorCompare is a web application and requires no installation on client devices. Supported browsers (current major version): Google Chrome / Chromium, Mozilla Firefox, Apple Safari (desktop and mobile), Microsoft Edge.

A stable network connection to the host server is required. The application is optimized for use on tablets but functions equally well on desktop computers.`,
      },
      {
        id: "2.5",
        title: "2.5 Network Requirements",
        body: `• The host server must be reachable from all client devices on the network.
• Port 443 (HTTPS) must be open to client devices. Port 80 is used by Caddy for initial TLS certificate issuance.
• For VPS deployments, the server's firewall must permit inbound traffic on ports 80 and 443.
• For local hardware deployments, the server must be accessible on the local area network. Remote access via VPN is recommended if staff need to reach the system from outside the restaurant.`,
      },
    ],
  },
  {
    id: 3,
    title: "3. Installation & Deployment",
    subsections: [
      {
        id: "3.1",
        title: "3.1 Overview of Deployment Options",
        body: `VendorCompare supports two primary deployment models:
• Local Hardware — Best for single-location restaurants with reliable local network. Requires an always-on machine on-premises.
• VPS — Best for multi-location or cloud-first operators. Requires a domain name and reliable internet.

Both options use identical Docker images and application code.`,
      },
      {
        id: "3.2",
        title: "3.2 Local Hardware Deployment",
        body: `Prerequisites: Machine running Linux (Ubuntu 22.04 LTS or Debian 12 recommended), macOS, or Windows Server with WSL2. Docker Engine and Docker Compose installed. Caddy installed. Local network access for all kitchen devices.

Steps:
1. Clone or extract the VendorCompare application package to a directory on the host machine (e.g., /opt/vendorcompare).
2. Copy the provided .env.example file to .env and populate all required variables (see Section 3.6).
3. Configure Caddy for local-network access (see Section 3.5).
4. Start the application stack using Docker Compose (see Section 3.4).
5. Verify the application is accessible in a browser from a device on the same network.

Configure the host machine to start Docker and Caddy automatically on boot so the system recovers from power interruptions without manual intervention.`,
      },
      {
        id: "3.3",
        title: "3.3 VPS Deployment",
        body: `Prerequisites: A VPS with a public IP address running a supported Linux distribution. A domain name or subdomain with an A record pointing to the VPS's public IP. Docker Engine and Docker Compose installed on the VPS. Caddy installed on the VPS. Firewall rules allowing inbound TCP on ports 80 and 443.

Steps:
1. SSH into the VPS and create the application directory (e.g., /opt/vendorcompare).
2. Upload or clone the application package into that directory.
3. Copy .env.example to .env and configure all variables (see Section 3.6).
4. Configure Caddy with the domain name for automatic TLS (see Section 3.5).
5. Start the stack with Docker Compose (see Section 3.4).
6. Visit the configured domain in a browser to confirm the application is running and HTTPS is active.

Security note: On a VPS, the application should only be accessible via HTTPS. Disable direct access to the Docker ports from the public internet using the VPS firewall.`,
      },
      {
        id: "3.4",
        title: "3.4 Docker Setup",
        body: `VendorCompare ships as a multi-container application defined in a docker-compose.yml file. The stack includes:
• backend — the FastAPI application server
• frontend — the compiled React web application, served as static files

Starting the application:
  cd /opt/vendorcompare && docker compose up -d

Stopping: docker compose down
Viewing logs: docker compose logs -f
Updating: docker compose pull && docker compose up -d

Data persistence: The SQLite database file is stored in a Docker volume. Back it up regularly. Do not delete the volume without first exporting the database.`,
      },
      {
        id: "3.5",
        title: "3.5 Caddy Configuration & HTTPS",
        body: `Caddy is the reverse proxy that handles HTTPS termination. It automatically obtains and renews TLS certificates from Let's Encrypt.

Basic Caddyfile for a public domain (VPS):
  vendorcompare.yourdomain.com {
    reverse_proxy localhost:8000
  }

For local network deployments without a public domain, you can use HTTP with a local IP, or use a local domain with a self-signed certificate (tls internal).

Reloading Caddy after configuration changes:
  caddy reload --config /etc/caddy/Caddyfile`,
      },
      {
        id: "3.6",
        title: "3.6 Environment Variables",
        body: `VendorCompare is configured via a .env file placed in the application root directory.

Required variables:
• SECRET_KEY — Secret key used to sign JWT tokens. Must be a long, random string (32+ chars).
• DATABASE_URL — Path to the SQLite database file. Example: sqlite:///./vendorcompare.db
• ALLOWED_ORIGINS — Comma-separated list of allowed frontend origins (CORS).
• ENVIRONMENT — Deployment environment tag. Example: production
• ADMIN_RECOVERY_CODE — Initial single-use admin recovery code (see Section 6.7).

Never commit the .env file to a public source repository. The SECRET_KEY must be unique per installation.

To generate a suitable SECRET_KEY:
  python3 -c "import secrets; print(secrets.token_hex(32))"`,
      },
      {
        id: "3.7",
        title: "3.7 First-Run Steps",
        body: `After starting the application for the first time:
1. Access the application in a browser at the configured domain or local address. The home screen should appear with three entry points.
2. Log in as Administrator using the admin PIN configured during initial setup (see Section 4.3).
3. Verify the default vendors are present in the Vault tab (US Foods, Food Direct, and Riviera Produce are seeded by default).
4. Add or update vendors, products, and employees as described in Section 4.
5. Set PAR values for all products before the first Inventory Count (see Section 4.5).
6. Test the full order workflow by submitting a test order as a kitchen staff member, then reviewing and approving it as Administrator.`,
      },
    ],
  },
  {
    id: 4,
    title: "4. Initial Configuration",
    subsections: [
      {
        id: "4.1",
        title: "4.1 Seeding Vendors",
        body: `VendorCompare ships with three default vendors pre-loaded: US Foods (Broadline distributor), Food Direct (Broadline distributor), and Riviera Produce (Produce specialist).

These defaults should be reviewed and updated to reflect your actual vendor relationships. You may:
• Keep vendors that match your current suppliers.
• Edit vendor names or details to match your records.
• Mute vendors you do not currently use (they remain available but are excluded from order splits).
• Delete vendors that are entirely irrelevant (they move to the Vault graveyard).

To add your own vendors from scratch, navigate to the Vault tab in the admin portal and use the "Add Vendor" option.`,
      },
      {
        id: "4.2",
        title: "4.2 The Product Catalog",
        body: `VendorCompare's product catalog is the list of items the kitchen can order. It is organized by category (e.g., Proteins, Produce, Dry Goods, Dairy, Dishwashing) and drives both the Quick Order and Inventory Count workflows.

At deployment, the product catalog is populated by the deployment team with the items specific to your restaurant. Each product record includes:
• Product name — as it will appear in the ordering interface
• Category — used to group products on the ordering screens
• Unit — the ordering unit (e.g., case, pound, each, gallon)

Pricing is not entered manually. VendorCompare determines which vendor offers the best price by reading from vendor price data uploaded to the Vault (see Section 8.4).

Tip: Keep product names consistent with how your vendors list them on their invoices. Consistent naming improves automatic price matching when vendor documents are uploaded.`,
      },
      {
        id: "4.3",
        title: "4.3 Setting Up Employees",
        body: `Every person who will use VendorCompare must have an employee record. To set up an employee, navigate to the Employee Management section and provide:
• Employee name
• Role — either "user" (kitchen staff) or "admin" (Administrator/Owner)
• PIN — a 4-digit PIN for users, or a 6-digit PIN for administrators

There is no limit to the number of employee records. Each employee has a unique PIN that serves as their sole credential for accessing the system.

Recommended practice: Create individual employee records for each staff member rather than sharing a single "kitchen" PIN. Individual records allow you to track which employee submitted which order, and make it straightforward to revoke access when someone leaves the team.`,
      },
      {
        id: "4.4",
        title: "4.4 Assigning PINs",
        body: `PINs are the authentication mechanism for VendorCompare.
• User PINs are exactly 4 digits. They grant access to the kitchen staff workflow (Quick Order, Inventory Count, Order Review).
• Admin PINs are exactly 6 digits. They grant access to the full admin portal in addition to the kitchen staff workflow.
• Each PIN must be unique across all employees.

PINs are set and managed in the Employee Management section of the admin portal. They can be changed at any time.

For the initial admin account, the PIN is set during first-time configuration. It is strongly recommended to change this PIN immediately after first login if a default was used.`,
      },
      {
        id: "4.5",
        title: "4.5 Setting PAR Values",
        body: `PAR (Periodic Automatic Replenishment) values define the target stock level for each product. When kitchen staff conduct an Inventory Count, they enter current on-hand quantities, and VendorCompare automatically calculates how much of each item needs to be ordered to return to PAR.

PAR values are set in the PAR Values section of the admin portal. For each product, enter the quantity that represents a full, properly stocked kitchen for your operation.

Examples:
• Canola Oil | Gallon | PAR 4 — Order enough to bring on-hand back to 4 gallons
• Chicken Breast | Case | PAR 3 — Order enough to bring on-hand back to 3 cases
• Roma Tomatoes | Case | PAR 5 — Order enough to bring on-hand back to 5 cases

PAR values should be set before the first Inventory Count is performed. They can be adjusted at any time. See Section 9 for detailed guidance.`,
      },
      {
        id: "4.6",
        title: "4.6 How Vendor Pricing Works",
        body: `VendorCompare's core value is automatic vendor comparison. Products in the catalog are vendor-agnostic — any product can be carried by any number of vendors at different prices. When an order is assembled, the system looks up all available prices for each item across all active (non-muted) vendors and routes each item to the vendor offering the lowest price.

Pricing is populated automatically by uploading vendor invoices and price sheets to the Vault (see Section 8.4). When a document is uploaded for a vendor, the system parses the pricing data and associates each item's price with the corresponding product in the catalog.

Manual price entry is available as a fallback for items that do not appear in vendor documents.

To keep pricing accurate:
• Upload updated vendor price sheets to the Vault whenever vendors issue new pricing.
• Review the Vault periodically to confirm that pricing data reflects current vendor rates.`,
      },
    ],
  },
  {
    id: 5,
    title: "5. User Guide — Kitchen Staff",
    subsections: [
      {
        id: "5.1",
        title: "5.1 Signing In",
        body: `When you open VendorCompare in a browser, you will be prompted to enter your PIN.
• If you are on a recognized device (a device that has been used with your account before), the system will go directly to the PIN entry screen.
• If you are on a new or unrecognized device, you may be asked to identify yourself before entering your PIN.

Enter your 4-digit PIN (or 6-digit PIN if you are an Administrator) and tap or click Sign In. If the PIN is correct, you will be taken to the Home screen.

PIN entry tips:
• PINs are numeric only. Use the on-screen keypad on a touchscreen device.
• If you enter the wrong PIN three or more times, wait a moment before trying again.
• If you cannot remember your PIN, ask the Owner or Administrator to reset it from the Employee Management section.`,
      },
      {
        id: "5.2",
        title: "5.2 Home Screen",
        body: `The Home screen is the starting point for all kitchen staff activity. It presents three entry points:
• Quick Order — Open the product catalog to manually select what you need to order
• Inventory Count — Enter current on-hand quantities; the system calculates what to order
• Owner's Portal — Access the owner/admin portal (visible to all, but requires a 6-digit admin PIN)

For most daily ordering, staff will use either Quick Order or Inventory Count. The Owner's Portal entry point is always visible on the Home screen but requires an admin-level PIN to access.`,
      },
      {
        id: "5.3",
        title: "5.3 Quick Order",
        body: `Quick Order is the free-form ordering method. Use it when you know what you need and want to select items directly from the catalog.

How to use Quick Order:
1. From the Home screen, tap Quick Order.
2. The screen displays all products organized by category. Categories are collapsed by default — tap a category header to expand it.
3. Use the search bar at the top to filter products in real time. As you type, the list narrows to show only matching items.
4. For each item you want to order, enter the desired quantity in the quantity field next to the product name.
5. Items you add are accumulated in the Cart Modal (see Section 5.5).
6. When you have selected all the items you need, tap Review Order to proceed to Order Review.

Tips:
• Use the search bar to jump directly to an item by name rather than scrolling through categories.
• Quick Order is best for ordering specific items you already know you need. For a comprehensive restocking order based on current inventory levels, use Inventory Count instead.`,
      },
      {
        id: "5.4",
        title: "5.4 Inventory Count",
        body: `Inventory Count is the structured ordering method. Instead of selecting items manually, you conduct a count of what is currently on hand, and VendorCompare calculates the order needed to bring everything back to PAR.

How to use Inventory Count:
1. From the Home screen, tap Inventory Count.
2. The screen displays all products that have a PAR value set, organized by category (collapsed by default).
3. For each item, enter the current on-hand quantity — how much you actually have right now.
4. The system automatically calculates the order quantity for each item: Order Qty = PAR − On Hand. If on-hand equals or exceeds PAR, no order quantity is generated for that item.
5. Use the search bar to quickly locate specific items.
6. When you have entered counts for all items, tap Review Order to proceed to Order Review.

Tips:
• Walk your entire kitchen — walk-in, dry storage, and reach-ins — before entering counts. Accurate counts produce accurate orders.
• Inventory Count is most effective when PAR values have been carefully set and kept current.`,
      },
      {
        id: "5.5",
        title: "5.5 The Cart Modal",
        body: `The Cart Modal is a running list of everything you have added to the current order. It is accessible from both Quick Order and Inventory Count.

The cart shows:
• Each selected product, along with its quantity and the vendor it is currently assigned to
• A summary of projected cost (if pricing is fully configured)

From the cart, you can:
• Edit quantities for any item before proceeding to Order Review
• Remove items you no longer want to include
• Clear the cart to start over

The Cart Modal does not finalize or save anything. It is simply a staging area for your order.`,
      },
      {
        id: "5.6",
        title: "5.6 Order Review (Pre-Save)",
        body: `Order Review is the final step before saving and submitting an order. It provides a full summary of the assembled order, organized by vendor, along with the calculated savings from the optimized split.

What you will see on Order Review:
• Vendor sections — items grouped by the vendor from which they will be ordered
• Per-vendor subtotals — the total cost from each vendor
• Savings summary — the estimated savings achieved by splitting the order across vendors
• Item-level detail — product name, quantity, unit, unit price, and line total

What you can do:
• Edit quantities — tap the quantity for any item to adjust it. Vendor split and totals update in real time.
• Flag an item — tap the 🚩 flag icon next to any item to flag it for the owner's attention (see Section 5.7)
• Add an order-level note — add a note that applies to the entire order (see Section 5.8)
• Save the order — when the order looks correct, tap Save to submit it to the Review Queue

Important: Nothing is sent to vendors from this screen. Saving an order submits it to the Administrator's Review Queue.`,
      },
      {
        id: "5.7",
        title: "5.7 Flag 🚩",
        body: `The Flag is a communication tool for kitchen staff to draw the owner's attention to a specific item in an order. When an item is flagged, it is highlighted in the Administrator's Review Queue so it is not overlooked.

When to use the Flag:
• When you are unsure about a quantity and want the owner to verify it
• When a product is being ordered from a different vendor than usual
• When you noticed something in the walk-in or storage that the owner should know about
• When you have a question about a specific item

How to flag an item:
1. On the Order Review screen, locate the item you want to flag.
2. Tap the 🚩 icon next to that item.
3. A text field will appear — enter a brief note explaining why the item is flagged.
4. Tap to confirm the flag.

Tip: Keep flag notes concise and specific.`,
      },
      {
        id: "5.8",
        title: "5.8 Order Notes",
        body: `VendorCompare supports two levels of notes on every order:

Item-Level Notes are entered via the Flag (see Section 5.7). They are attached to a specific product within the order.

Order-Level Notes are a free-text field on the Order Review screen that apply to the entire order. Use them to communicate anything about the overall order that is not specific to a single item — for example:
• "Vendor said they may be out of Roma tomatoes this week — may need a substitution."
• "Need by Thursday for the weekend event."
• "Second order this week — ran low after a busy Monday."

Both item-level and order-level notes are visible to the Administrator in the Review Queue.`,
      },
      {
        id: "5.9",
        title: "5.9 Saving an Order",
        body: `When you are satisfied with the order on the Order Review screen, tap the Save button. This action:
1. Saves the order to the database.
2. Assigns the order a sequential order number (e.g., Order #47).
3. Places the order in the Administrator's Review Queue.
4. Locks the order for editing (kitchen staff cannot modify a saved order; the Administrator can reopen it if changes are needed).

You will receive on-screen confirmation that the order has been saved and a number assigned.

Note: Saving is a one-way action from the staff side. Once saved, you cannot delete or recall the order. If the order contains an error, flag it with a Flag note, or notify the Administrator directly.`,
      },
      {
        id: "5.10",
        title: "5.10 After Save — Order Number",
        body: `Once an order is saved, it is referred to by its sequential order number throughout the system. You may see it as Order #1, Order #47, etc.

Order numbers increment automatically and never repeat. They provide a simple, unambiguous reference when discussing a specific order with the Administrator or vendor.

After saving, you can:
• Return to the Home screen to start a new order.
• Note the order number for your records or to reference when speaking with the Administrator.`,
      },
    ],
  },
  {
    id: 6,
    title: "6. User Guide — Owner / Administrator",
    subsections: [
      {
        id: "6.1",
        title: "6.1 Accessing the Owner's Portal",
        body: `From the Home screen, tap the Owner's Portal button. You will be prompted to enter your 6-digit admin PIN. Upon successful authentication, you will enter the admin portal.

The admin portal contains the following sections:
• Review Queue
• Order History
• PAR Values
• Vault
• Employee Management
• Recovery Code`,
      },
      {
        id: "6.2",
        title: "6.2 Review Queue",
        body: `The Review Queue is where submitted orders await your approval. Every order saved by kitchen staff appears here until it is approved or sent back.

What you see in the Review Queue:
• A list of pending orders (order number, date/time submitted, submitting employee, total cost)
• Orders containing flagged items are visually highlighted
• Tapping an order opens the full detail view

Inside an order:
• All items organized by vendor
• Vendor subtotals and overall order total
• Flagged items prominently marked with the associated staff note
• Order-level notes from the staff member
• Item quantities (editable)

Actions available:
• Approve — Confirms the order as-is; it moves to Order History
• Edit — Adjust quantities or notes before approving
• Reopen — Returns the order to a draft state if significant changes are needed
• Dismiss / Archive — Removes the order from the active queue

Best practice: Review the queue at least once per day.`,
      },
      {
        id: "6.3",
        title: "6.3 Order History",
        body: `Order History is the complete archive of all orders that have passed through VendorCompare.

Filtering options: This Week, This Month, This Quarter, This Year, All Time.

Viewing an order from history: Tap any order to open its full detail view. All items, vendor splits, notes, and flags are preserved exactly as they appeared at the time of submission and approval.

CSV Export: From the Order History view, you can export orders as a CSV file. The export includes all order line items, quantities, vendor assignments, unit prices, and totals. This data can be imported into a spreadsheet application for cost analysis, reporting, or accounting purposes.

Reopening an order: If an order needs to be revisited, you can reopen it from Order History. Reopening places the order back in the Review Queue in an editable state.`,
      },
      {
        id: "6.4",
        title: "6.4 PAR Values",
        body: `The PAR Values section is where you set and maintain the target stock levels for all products. This is a critical configuration area — accurate PAR values are what make the Inventory Count workflow effective.

How the PAR Values screen works:
• All products are listed with their current PAR value.
• Use the search bar to find specific products quickly.
• Tap the PAR field for any product to edit it. Changes are saved automatically (no save button required).

For detailed guidance on setting and tuning PAR values, see Section 9.`,
      },
      {
        id: "6.5",
        title: "6.5 Vault — Vendor Management",
        body: `The Vault tab is the central hub for all vendor management activity. It contains the active vendor list, controls for muting vendors, and a graveyard for deleted vendors.

Quick reference — Vault actions:
• Add Vendor — Creates a new vendor record
• Edit Vendor — Update name, contact, or details
• Mute Vendor — Excludes vendor from order splits; vendor and its pricing data remain
• Delete Vendor — Moves vendor to Graveyard; can be restored
• Restore from Graveyard — Restores a previously deleted vendor

For a complete discussion of vendor management, see Section 8.`,
      },
      {
        id: "6.6",
        title: "6.6 Employee Management",
        body: `Employee Management is where you control who has access to VendorCompare and at what level.

Adding an employee:
1. Navigate to Employee Management.
2. Tap Add Employee.
3. Enter the employee's name, assign a role (user or admin), and set their PIN.
4. Save the record.

Removing an employee: To revoke access for an employee who has left the team, locate their record and delete it. Their past order submissions remain in Order History with their name attached.

Changing a PIN: Locate the employee's record and tap the PIN field to enter a new value. The change takes effect immediately.

Role definitions:
• user — 4-digit PIN — Kitchen staff workflow only (Quick Order, Inventory Count, Order Review)
• admin — 6-digit PIN — Full access — kitchen workflow plus entire admin portal

Best practice: Limit the number of admin-level accounts to the Owner and one or two trusted administrators.`,
      },
      {
        id: "6.7",
        title: "6.7 Recovery Code",
        body: `The Recovery Code is a single-use emergency access mechanism for situations where the Administrator has lost their PIN.

How the Recovery Code works:
• A recovery code is pre-configured in the system (via the ADMIN_RECOVERY_CODE environment variable, or set from the admin portal).
• If an administrator is locked out, they can enter the recovery code in place of a PIN to regain access.
• The code is single-use — once used, it is consumed and must be regenerated before it can be used again.

Generating a new recovery code:
1. Log in to the admin portal normally.
2. Navigate to the Recovery Code section.
3. Generate a new code and store it securely (e.g., in a password manager or printed and stored in a locked location).
4. The previous code, if any, is invalidated.

Security caution: The recovery code is a high-privilege credential. Treat it like the master key to the system.`,
      },
    ],
  },
  {
    id: 7,
    title: "7. Authentication & Security",
    subsections: [
      {
        id: "7.1",
        title: "7.1 How Authentication Works",
        body: `VendorCompare uses PIN-based authentication. There are no usernames or passwords. Each employee is identified solely by their PIN.

Authentication flow:
1. The user opens VendorCompare in a browser.
2. If the device is recognized (via a device cookie — see Section 7.2), the system goes directly to the PIN entry screen.
3. The user enters their PIN. The system validates it against the employee database.
4. If the PIN is valid, the system issues a JWT (JSON Web Token) — a secure, time-limited session token — and grants access.
5. The JWT is valid for 12 hours. After 12 hours, the user is automatically signed out and must re-enter their PIN.

PIN length determines role: A 4-digit PIN always grants user-level access; a 6-digit PIN always grants admin-level access.`,
      },
      {
        id: "7.2",
        title: "7.2 Device Cookies",
        body: `When a user successfully signs in from a device, VendorCompare sets a device recognition cookie on that browser. This cookie:
• Has a 1-year expiration
• Is HttpOnly (not accessible to JavaScript — reduces XSS risk)
• Is Secure (only transmitted over HTTPS)

The device cookie does not authenticate the user — it simply tells the system that this device has been used with VendorCompare before, allowing it to skip the device identification step.

Implications for shared devices: If multiple staff members use the same tablet, the device cookie is shared among them. This is normal and expected — each person still authenticates with their own PIN.

Clearing the cookie: Clear the browser's cookies for the VendorCompare domain. The next visit will treat the device as new.`,
      },
      {
        id: "7.3",
        title: "7.3 PIN Management",
        body: `Choosing strong PINs:
• Avoid obvious PINs (1234, 0000, 1111, birth years).
• Assign different PINs to each employee.
• Rotate admin PINs periodically (e.g., quarterly, or whenever an admin-level employee leaves).

When to change a PIN:
• Employee leaves the organization — Delete their employee record or change their PIN immediately
• PIN is suspected to be known by unauthorized parties — Change the PIN immediately
• Regular security rotation — Change admin PINs at least twice per year
• Employee forgets PIN — Administrator resets it from Employee Management

Admin PIN loss: If the sole administrator loses their PIN and no other admin-level account exists, use the Recovery Code to regain access (see Section 6.7).`,
      },
      {
        id: "7.4",
        title: "7.4 Idle Timeout & Session Expiry",
        body: `VendorCompare automatically signs out inactive sessions to reduce the risk of unauthorized access on shared devices.

• Idle timeout: 20 minutes of inactivity. If no interaction is detected within 20 minutes, the session ends and the user must re-enter their PIN.
• JWT expiry: Session tokens expire after 12 hours regardless of activity.

These timeouts apply to both user and admin sessions and cannot be extended by the user. If a session times out during an in-progress order, the data entered up to that point may be lost — users should save orders promptly after completion.`,
      },
      {
        id: "7.5",
        title: "7.5 Network Security Recommendations",
        body: `For all deployments:
• Always run VendorCompare behind Caddy with a valid TLS certificate. Never deploy over unencrypted HTTP in a production environment.
• Keep the host server's operating system and Docker packages up to date with security patches.
• Use a strong, unique SECRET_KEY in the .env file. Rotate this key if it is ever suspected to be compromised (note: rotating the key will invalidate all active sessions).

For local hardware deployments:
• Restrict the application to the restaurant's local area network. Do not expose it directly to the internet unless you have specific need and appropriate security controls.
• If staff need remote access, use a VPN (e.g., WireGuard or Tailscale) to connect to the local network first.
• Network segmentation: Host the application on a dedicated staff network that is separate from any guest or public Wi-Fi network.

For VPS deployments:
• Configure the VPS firewall to allow only ports 80 and 443 from the public internet.
• Consider IP allowlisting if all users access the application from known, static IP addresses.
• Enable automatic security updates on the VPS operating system.

General:
• The database file contains all order history, employee PINs (stored as hashes), and vendor pricing. Back it up regularly and store backups securely.
• Periodically audit the employee list to ensure that former staff members no longer have active PIN access.`,
      },
    ],
  },
  {
    id: 8,
    title: "8. Vendor Management",
    subsections: [
      {
        id: "8.1",
        title: "8.1 Adding a Vendor",
        body: `Vendors represent the suppliers from whom your restaurant orders products. To add a new vendor:
1. Navigate to the Vault tab in the admin portal.
2. Tap Add Vendor.
3. Enter the vendor's name and any relevant contact details.
4. Save the record.

Once a vendor is added, it becomes available for assignment to products and will appear in order splits.

VendorCompare ships with three default vendors: US Foods, Food Direct, and Riviera Produce. These can be edited, muted, or deleted as appropriate for your operation.`,
      },
      {
        id: "8.2",
        title: "8.2 Muting a Vendor",
        body: `Muting a vendor temporarily removes it from all order splits without deleting its record or any associated pricing data. A muted vendor will not receive any portion of an assembled order.

When to mute a vendor:
• The vendor is temporarily out of service or closed for a period.
• You are pausing the relationship without ending it permanently.
• You want to test the system's split behavior without a specific vendor in the pool.

How to mute a vendor:
1. Navigate to the Vault tab.
2. Locate the vendor in the active vendor list.
3. Toggle the Mute switch on the vendor's row.

To unmute, toggle the switch again. The vendor will immediately return to eligibility for order splits.

Muted vendors and existing orders: Muting a vendor does not affect orders that have already been assembled or are in the Review Queue. It only affects new orders assembled after the mute is applied.`,
      },
      {
        id: "8.3",
        title: "8.3 The Vault Tab",
        body: `The Vault tab is the complete vendor management interface. It contains:

Active Vendors: All currently active (unmuted) vendors. These vendors are eligible to appear in order splits.

Muted Vendors: Vendors that have been muted. They retain all their data and product assignments but are excluded from splits until unmuted.

Graveyard: Vendors that have been deleted. Deletion is non-destructive — deleted vendors move to the Graveyard rather than being permanently removed from the database. From the Graveyard, a vendor can be restored to the active list at any time.

This design means that if a supplier relationship is paused or ends and later resumes, all historical pricing data and product assignments remain intact.`,
      },
      {
        id: "8.4",
        title: "8.4 Document Uploads",
        body: `The Vault supports uploading documents to vendor records. This feature is intended for storing vendor-related files alongside the vendor record for easy reference.

Typical documents to upload:
• Vendor price sheets
• Order guides
• Vendor contact information sheets
• Contracts or service agreements

To upload a document:
1. Navigate to the vendor's record in the Vault.
2. Locate the document upload section.
3. Select or drag-and-drop the file.

Documents are stored on the server and accessible from the vendor record. Supported file types include PDF and common image formats. Always check that pricing in the system matches the most recent uploaded price sheet.`,
      },
    ],
  },
  {
    id: 9,
    title: "9. Product & PAR Management",
    subsections: [
      {
        id: "9.1",
        title: "9.1 What PAR Is",
        body: `PAR stands for Periodic Automatic Replenishment. A PAR value for a product is the quantity that represents a full, appropriately stocked kitchen for your typical operation. It is the target — not the minimum, not the maximum, but the right amount to have on hand before the next order cycle.

When kitchen staff conduct an Inventory Count, they enter how much of each item is currently on hand. VendorCompare then calculates:

  Order Quantity = PAR Value − Current On-Hand Quantity

If on-hand is equal to or greater than PAR, the order quantity for that item is zero — no order is needed.

PAR is a simple but powerful concept. When it is calibrated correctly, the Inventory Count workflow produces an accurate, complete order with minimal guesswork.`,
      },
      {
        id: "9.2",
        title: "9.2 Setting PAR Values",
        body: `PAR values are set in the PAR Values section of the admin portal.

The process for initial PAR setting:
1. For each product, think about how much of that item you need to have on hand at the start of a typical ordering cycle (weekly, twice-weekly, etc.).
2. Factor in expected usage between now and your next order, plus a buffer for variance.
3. Enter that quantity as the PAR value.

Example PAR calculation: Suppose you order produce twice per week. You typically use 3 cases of Roma tomatoes between orders, and you want to keep 1 case as a buffer. Your PAR value for Roma tomatoes should be 4 cases (3 expected use + 1 buffer).

PAR Values screen features:
• All products are listed with their current PAR value displayed inline.
• Use the search bar to locate specific products quickly.
• PAR values auto-save as you type — there is no save button to tap.`,
      },
      {
        id: "9.3",
        title: "9.3 Tuning PAR Over Time",
        body: `PAR values are not a set-and-forget configuration. They should be reviewed and adjusted regularly as your business evolves.

Signs that a PAR value needs adjustment:
• Consistently running out of an item before the next order → PAR set too low → Increase the PAR value
• Consistently having leftover stock when the next order arrives → PAR set too high → Decrease the PAR value
• Orders are consistently larger or smaller during certain periods → Seasonal demand → Adjust PAR seasonally
• A menu change adds or removes a product → Update affected PAR values

Recommended review cadence: Review all PAR values at least once per quarter, and immediately after any significant menu change or shift in order frequency.

Practical tip: Keep notes in the Order History (via order-level notes) about unusually busy or slow periods. This data helps explain anomalies in inventory levels and informs future PAR adjustments.`,
      },
    ],
  },
  {
    id: 10,
    title: "10. Order Lifecycle",
    subsections: [
      {
        id: "10.1",
        title: "10.1 Starting an Order",
        body: `An order begins when a kitchen staff member selects either Quick Order or Inventory Count from the Home screen.

• Quick Order — the staff member selects items and quantities manually from the product catalog.
• Inventory Count — the staff member enters on-hand quantities for products; the system calculates order quantities from PAR values.

In both cases, the result is a set of products with quantities to be ordered.`,
      },
      {
        id: "10.2",
        title: "10.2 Assembly & Vendor Splitting",
        body: `When the staff member proceeds from the item selection phase to Order Review, VendorCompare assembles the order. Assembly involves:
1. Looking up all vendor-price pairs for each item in the order.
2. Assigning each item to the vendor offering the lowest price for that item.
3. Grouping items by vendor to form individual vendor sub-orders.
4. Calculating the total cost per vendor and an overall order total.
5. Calculating the savings achieved by splitting versus ordering everything from the highest-priced vendor.

The assembled order is presented to the staff member on the Order Review screen. At this point, it exists only in the browser — nothing has been saved to the database yet.

What affects the split:
• Vendor pricing data in the product catalog
• Whether a vendor is muted (muted vendors are excluded from splits)
• Whether a product is only assigned to one vendor (no split possible for that item)`,
      },
      {
        id: "10.3",
        title: "10.3 Review & Annotation",
        body: `On the Order Review screen, the staff member reviews the assembled order in full. This is the opportunity to:
• Verify quantities are correct
• Adjust any quantities that need to change
• Flag items of concern with the Flag 🚩 (see Section 5.7)
• Add order-level notes for the Administrator (see Section 5.8)

The Order Review screen is the staff member's last chance to make changes before the order is submitted.`,
      },
      {
        id: "10.4",
        title: "10.4 Saving & Submission",
        body: `When the staff member taps Save on the Order Review screen:
1. The order is written to the database with a status of Pending.
2. A sequential order number is assigned (Order #N).
3. The order appears in the Administrator's Review Queue.
4. The staff member's session returns to the Home screen (or displays a confirmation).

The order is now in the Administrator's hands. The kitchen staff have no further ability to modify it.`,
      },
      {
        id: "10.5",
        title: "10.5 Admin Approval",
        body: `The Administrator reviews the order in the Review Queue (see Section 6.2). In summary:
• The Administrator opens the order and reviews all items, vendor splits, costs, and any flags or notes from staff.
• Flagged items are highlighted for attention.
• The Administrator may approve the order as-is, edit quantities before approving, or reopen it for staff revision.
• Upon approval, the order's status changes to Approved and it moves out of the Review Queue.

Important: Approving an order in VendorCompare does not automatically transmit the order to vendors. The Administrator is responsible for placing orders with vendors through their existing channels (phone, email, vendor portal, EDI, etc.) using the approved order as the source document.`,
      },
      {
        id: "10.6",
        title: "10.6 Archiving & History",
        body: `Once approved, every order is preserved permanently in Order History. Orders in history are read-only by default but can be reopened if needed.

The complete order record — all items, quantities, vendor splits, pricing, staff notes, and flags — is retained indefinitely. This historical record serves multiple purposes:
• Cost tracking — filter by period and export to CSV for cost analysis
• Trend identification — observe ordering patterns over time to inform PAR adjustments
• Dispute resolution — if a vendor questions an order, the exact details are on record
• Auditing — know who ordered what, when, and at what price

There is no automatic archival or deletion of old orders. Order History grows continuously.`,
      },
    ],
  },
  {
    id: 11,
    title: "11. Troubleshooting",
    subsections: [
      {
        id: "11.1",
        title: "11.1 Application Will Not Start",
        body: `Symptom: The VendorCompare URL shows an error or the browser cannot connect.

Steps:
1. Check that the Docker containers are running: docker compose ps should show both containers as "Up".
2. If containers are not running, check logs: docker compose logs.
3. Verify that Caddy is running and configured correctly: caddy validate --config /etc/caddy/Caddyfile.
4. Confirm the .env file exists and all required variables are populated.
5. Check that the host firewall is not blocking ports 80 and 443.`,
      },
      {
        id: "11.2",
        title: "11.2 Cannot Log In — PIN Not Accepted",
        body: `Symptom: A valid PIN is entered but authentication fails.

Steps:
1. Confirm the employee record exists in Employee Management and the PIN is set correctly.
2. Confirm the PIN length matches the role: 4 digits for users, 6 digits for admins.
3. Check for typos — PINs are numeric only.
4. If the employee is an admin who has lost their PIN, use the Recovery Code to regain access (see Section 6.7).
5. If no admin can log in and the Recovery Code is not available, contact your system administrator or deployment support.`,
      },
      {
        id: "11.3",
        title: "11.3 Order Splits Are Incorrect or Unexpected",
        body: `Symptom: An item is assigned to the wrong vendor, or a vendor is not appearing in splits.

Steps:
1. Verify that the product has pricing entries for the expected vendors.
2. Check whether the expected vendor is muted. A muted vendor will be excluded from all splits.
3. Confirm that the vendor pricing data is current. Outdated prices may cause unexpected split behavior.
4. If only one vendor is assigned to a product, that vendor will always receive that item — no split is possible.`,
      },
      {
        id: "11.4",
        title: "11.4 Inventory Count Produces Unexpected Order Quantities",
        body: `Symptom: The calculated order quantities after an Inventory Count seem too high or too low.

Steps:
1. Verify that PAR values are set correctly for the affected products (Section 9).
2. Confirm that the on-hand quantities entered were accurate. Even a small error in counting can significantly affect the order.
3. Check whether any items have a PAR of zero — these will never generate an order quantity regardless of on-hand level.`,
      },
      {
        id: "11.5",
        title: "11.5 Order History Is Missing Orders",
        body: `Symptom: An order that was submitted does not appear in Order History.

Steps:
1. Check the Review Queue — the order may still be pending admin review.
2. Verify the date filter on Order History. If the filter is set to "This Week," orders from prior periods will not appear — try "All Time."
3. If the order genuinely cannot be found, it may not have been saved correctly. Confirm with the kitchen staff member whether the save confirmation appeared.`,
      },
      {
        id: "11.6",
        title: "11.6 CSV Export Is Empty or Incomplete",
        body: `Symptom: The exported CSV file contains no data or is missing expected orders.

Steps:
1. Verify the date filter is set to the appropriate range before exporting.
2. Confirm that orders in the selected range have been approved (pending orders may not be included in the export).
3. Check that the browser is not blocking the file download. Allow file downloads from the VendorCompare domain in the browser settings.`,
      },
      {
        id: "11.7",
        title: "11.7 The Application Is Slow",
        body: `Symptom: Pages take unusually long to load.

Steps:
1. Check the host server's resource usage (CPU, memory). An undersized VPS or a host machine with other competing workloads may cause slowness.
2. Review the Docker container logs for error messages that might indicate a bottleneck.
3. Verify that the client device has a stable network connection to the server.
4. On a VPS, check for any scheduled backups or maintenance tasks running during business hours.`,
      },
      {
        id: "11.8",
        title: "11.8 Forgot Admin PIN / All Admins Locked Out",
        body: `Symptom: No administrator can log in.

Steps:
1. Use the pre-configured Recovery Code to log in. The recovery code can be entered in the PIN field on the login screen.
2. Once in, immediately navigate to Employee Management to reset the relevant admin PIN(s).
3. Generate a new Recovery Code to replace the one that was just consumed.
4. If the Recovery Code is also unavailable, access to the system may require direct intervention at the server level. Contact your deployment administrator.`,
      },
    ],
  },
  {
    id: 12,
    title: "12. Glossary",
    subsections: [
      {
        id: "12.0",
        title: "12. Glossary",
        body: `Admin Portal — The management interface accessible only to users with an admin-level PIN. Contains the Review Queue, Order History, PAR Values, Vault, Employee Management, and Recovery Code sections.

Assembly — The process by which VendorCompare takes a list of selected products and quantities, looks up vendor pricing, and assigns each item to the optimal vendor to produce an optimized vendor split.

Cart Modal — A staging overlay that accumulates product selections during the Quick Order and Inventory Count workflows. Products are held in the cart until the user proceeds to Order Review.

Device Cookie — A browser cookie set by VendorCompare on first sign-in. It allows the system to recognize a returning device, bypassing the device identification step. Does not substitute for PIN authentication.

Flag 🚩 — An item-level annotation tool that allows kitchen staff to flag a specific product in an order and attach a note for the Administrator's attention.

Graveyard — The section of the Vault tab containing deleted vendor records. Deleted vendors are retained here and can be restored to the active vendor list at any time.

Idle Timeout — The 20-minute period of inactivity after which a session is automatically terminated.

Inventory Count — An ordering method in which staff enter current on-hand quantities for products, and the system calculates order quantities based on PAR values.

JWT (JSON Web Token) — The session token issued after a successful PIN authentication. Valid for 12 hours. Authorizes all subsequent API requests during the session.

Mute (Vendor) — A reversible setting that removes a vendor from consideration in order splits without deleting the vendor record or its associated pricing data.

Order History — The complete archive of all approved orders in VendorCompare, accessible from the admin portal with date filters and CSV export.

Order Number — A sequential integer assigned to an order upon saving (e.g., Order #1, Order #47). Numbers are unique and never reused.

Order Review — The pre-save screen where kitchen staff review the assembled order — including vendor splits, costs, and savings — before submitting it for admin approval.

Owner's Portal — The management interface for the Owner and Administrator, accessed from the Home screen using a 6-digit admin PIN.

PAR (Periodic Automatic Replenishment) — The target on-hand quantity for a product. The basis for Inventory Count order calculations. Set and maintained in the admin portal.

Review Queue — The admin portal section where submitted orders await approval. Displays all pending orders, with flagged items highlighted.

Vault — The admin portal section dedicated to vendor management. Contains the active vendor list, muted vendors, the Graveyard, and document upload functionality.

Vendor Split — The result of the assembly process: a breakdown of order items assigned to different vendors based on pricing. The goal is to minimize total order cost.`,
      },
    ],
  },
  {
    id: 13,
    title: "13. Index",
    subsections: [
      {
        id: "13.0",
        title: "13. Index",
        body: `Admin PIN (6-digit) — Sections 4.4, 6.1, 7.1, 7.3
Admin Portal, accessing — Section 6.1
Assembly (vendor split process) — Sections 4.6, 10.2
Authentication flow — Section 7.1
Backup (database) — Sections 3.4, 7.5
Cart Modal — Section 5.5
Caddy configuration — Section 3.5
CSV export — Section 6.3
Default vendors — Sections 4.1, 8.1
Device cookie — Section 7.2
Docker Compose — Section 3.4
Employee Management — Sections 4.3, 4.4, 6.6
Environment variables — Section 3.6
Flag 🚩 — Sections 5.7, 10.3
Graveyard (Vault) — Section 8.3
Home screen — Section 5.2
Idle timeout — Section 7.4
Initial configuration — Section 4
Installation — local hardware — Section 3.2
Installation — VPS — Section 3.3
Inventory Count — Sections 5.4, 10.1
JWT session token — Sections 7.1, 7.4
Muting a vendor — Section 8.2
Network security — Section 7.5
Order approval — Sections 6.2, 10.5
Order History — Sections 6.3, 10.6
Order lifecycle — Section 10
Order notes (item-level) — Section 5.7
Order notes (order-level) — Section 5.8
Order number — Sections 5.10, 10.4
Order Review screen — Sections 5.6, 10.3
Owner's Portal — Sections 5.2, 6.1
PAR values — definition — Section 9.1
PAR values — setting — Sections 4.5, 9.2
PAR values — tuning — Section 9.3
PIN management — Section 7.3
Product catalog — Section 4.2
Quick Order — Sections 5.3, 10.1
Recovery Code — Sections 6.7, 11.8
Review Queue — Sections 6.2, 10.5
Saving an order — Sections 5.9, 10.4
Search (real-time) — Sections 5.3, 5.4, 6.4
System requirements — Section 2
Troubleshooting — Section 11
Vault tab — Sections 6.5, 8.3
Vendor management — Section 8
Vendor split — Sections 4.6, 10.2
VPS deployment — Section 3.3`,
      },
    ],
  },
]

export default manualSections
