# EcoBud Eco Events - Simple Flow

## User Flow (Mobile App)

```mermaid
flowchart TD
    A["User Opens App"] --> B{"Browses Events"}
    B --> C["Sees Event on Home Screen\nor Events Page"]
    C --> D["Taps 'Join Event'"]
    D --> E["Slot Reserved ✓"]

    E --> F{"Event Day Arrives"}
    F --> G["User Goes to Event Location"]
    G --> H["Takes a Photo as Proof"]
    H --> I["Scans QR Code at Venue"]
    I --> J{"Valid QR for Ongoing Event?"}
    J -->|"Yes"| K["Attendance Automatically Approved"]
    K --> L["User Sees 'Claim Reward'"]
    J -->|"No"| M["Scan Error Shown\nUser Can Try Again"]
    M --> I

    L --> N["User Taps 'Claim Reward'"]
    N --> O["Earns Eco-Points\n& Eco-Coins 🎉"]
```

## Admin Flow (Web Panel)

```mermaid
flowchart TD
    A["Admin Opens\nWeb Panel"] --> B["Events Dashboard"]

    B --> C{"What Does\nAdmin Want?"}
    C -->|"Create Event"| D["Fills Event Details\nTitle, Date, Location,\nCapacity, Rewards"]
    D --> E["Uploads Event Image"]
    E --> F["Event is Live ✓"]

    C -->|"Manage Event"| G["Edits or Deletes\nExisting Event"]
    G --> H["Event Updated ✓"]

    C -->|"Generate QR Code"| I["Creates QR Code\nfor Event Venue"]
    I --> J["QR Ready to Display ✓"]

    C -->|"View Attendance"| K["View Participant Photos\nand Automatically Approved Attendance"]
```

## Event Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Upcoming : Event Created
    Upcoming --> Ongoing : Event Start Date
    Ongoing --> Ended : Event End Date

    state Ongoing {
        [*] --> OpenForAttendance
        OpenForAttendance --> Approved : User Submits Photo and Valid QR
        Approved --> RewardClaimed : User Claims
    }
```

## How Registration Status Changes

```mermaid
flowchart LR
    A["REGISTERED\nJoined Event"] --> C["ATTENDED\nValid QR Automatically Approved ✓"]
    C --> E["REWARD_CLAIMED\nDone 🎉"]
```
