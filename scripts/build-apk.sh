#!/usr/bin/env bash
# Compile l'APK Android SANS Gradle ni SDK Google, avec les outils Android empaquetés par Debian/Ubuntu :
#   sudo apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
# Résultat : build/superessence-debug.apk (signé avec une clé de debug locale).
set -euo pipefail
cd "$(dirname "$0")/.."
SDK=${ANDROID_SDK_DEBIAN:-/usr/lib/android-sdk}
JAR="$SDK/platforms/android-23/android.jar"
BT="$SDK/build-tools/debian"
OUT=build/apk
rm -rf "$OUT" && mkdir -p "$OUT"/{obj,assets,res}

echo "1/6 Build web (fichier unique)…"
npx vite build -c vite.android.config.ts >/dev/null
cp dist-android/index.html "$OUT/assets/index.html"

echo "2/6 Ressources (icônes, textes)…"
cp -r android-native/res/* "$OUT/res/"
python3 scripts/make-icon.py "$OUT/res"
rm -f "$OUT/res/icon-512.png"

echo "3/6 Compilation Java…"
javac -source 8 -target 8 -nowarn -Xlint:-options -bootclasspath "$JAR" -d "$OUT/obj" \
  android-native/src/com/superessence/abyssarena/MainActivity.java

echo "4/6 Conversion en bytecode Dalvik…"
java -jar "$BT/lib/dx.jar" --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/obj"

echo "5/6 Empaquetage…"
aapt package -f -M android-native/AndroidManifest.xml -S "$OUT/res" -A "$OUT/assets" -I "$JAR" -F "$OUT/unsigned.apk"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "6/6 Signature…"
KS=${KEYSTORE:-android-native/debug.keystore}
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias superessence \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SUPERESSENCE Debug,O=SUPERESSENCE,C=FR" >/dev/null 2>&1
fi
mkdir -p build
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias superessence \
  --out build/superessence-debug.apk "$OUT/aligned.apk"
apksigner verify --print-certs build/superessence-debug.apk | head -2
ls -la build/superessence-debug.apk
