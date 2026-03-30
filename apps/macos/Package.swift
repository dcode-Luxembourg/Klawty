// swift-tools-version: 6.2
// Package manifest for the Klawty macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "Klawty",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "KlawtyIPC", targets: ["KlawtyIPC"]),
        .library(name: "KlawtyDiscovery", targets: ["KlawtyDiscovery"]),
        .executable(name: "Klawty", targets: ["Klawty"]),
        .executable(name: "klawty-mac", targets: ["KlawtyMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/KlawtyKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "KlawtyIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "KlawtyDiscovery",
            dependencies: [
                .product(name: "KlawtyKit", package: "KlawtyKit"),
            ],
            path: "Sources/KlawtyDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "Klawty",
            dependencies: [
                "KlawtyIPC",
                "KlawtyDiscovery",
                .product(name: "KlawtyKit", package: "KlawtyKit"),
                .product(name: "KlawtyChatUI", package: "KlawtyKit"),
                .product(name: "KlawtyProtocol", package: "KlawtyKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/Klawty.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "KlawtyMacCLI",
            dependencies: [
                "KlawtyDiscovery",
                .product(name: "KlawtyKit", package: "KlawtyKit"),
                .product(name: "KlawtyProtocol", package: "KlawtyKit"),
            ],
            path: "Sources/KlawtyMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "KlawtyIPCTests",
            dependencies: [
                "KlawtyIPC",
                "Klawty",
                "KlawtyDiscovery",
                .product(name: "KlawtyProtocol", package: "KlawtyKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
