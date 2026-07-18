// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),
        .package(name: "AparajitaCapacitorBiometricAuth", path: "../../../../../node_modules/.pnpm/@aparajita+capacitor-biometric-auth@10.0.0/node_modules/@aparajita/capacitor-biometric-auth"),
        .package(name: "CapacitorCommunityFileOpener", path: "../../../../../node_modules/.pnpm/@capacitor-community+file-opener@8.0.1_@capacitor+core@8.4.0/node_modules/@capacitor-community/file-opener"),
        .package(name: "CapacitorCommunitySqlite", path: "../../../../../node_modules/.pnpm/@capacitor-community+sqlite@8.1.0_@capacitor+core@8.4.0/node_modules/@capacitor-community/sqlite"),
        .package(name: "CapacitorCommunityTextToSpeech", path: "../../../../../node_modules/.pnpm/@capacitor-community+text-to-speech@8.0.1_@capacitor+core@8.4.0/node_modules/@capacitor-community/text-to-speech"),
        .package(name: "CapacitorApp", path: "../../../../../node_modules/.pnpm/@capacitor+app@8.1.0_@capacitor+core@8.4.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorCamera", path: "../../../../../node_modules/.pnpm/@capacitor+camera@8.2.0_@capacitor+core@8.4.0/node_modules/@capacitor/camera"),
        .package(name: "CapacitorFilesystem", path: "../../../../../node_modules/.pnpm/@capacitor+filesystem@8.1.2_@capacitor+core@8.4.0/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorHaptics", path: "../../../../../node_modules/.pnpm/@capacitor+haptics@8.0.2_@capacitor+core@8.4.0/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorPreferences", path: "../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.4.0/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorShare", path: "../../../../../node_modules/.pnpm/@capacitor+share@8.0.1_@capacitor+core@8.4.0/node_modules/@capacitor/share"),
        .package(name: "CapacitorSecureStoragePlugin", path: "../../../../../node_modules/.pnpm/capacitor-secure-storage-plugin@0.13.0_@capacitor+core@8.4.0/node_modules/capacitor-secure-storage-plugin")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AparajitaCapacitorBiometricAuth", package: "AparajitaCapacitorBiometricAuth"),
                .product(name: "CapacitorCommunityFileOpener", package: "CapacitorCommunityFileOpener"),
                .product(name: "CapacitorCommunitySqlite", package: "CapacitorCommunitySqlite"),
                .product(name: "CapacitorCommunityTextToSpeech", package: "CapacitorCommunityTextToSpeech"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorSecureStoragePlugin", package: "CapacitorSecureStoragePlugin")
            ]
        )
    ]
)
