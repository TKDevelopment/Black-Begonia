module.exports = function (config) {
  const responsiveMatrixEnabled = process.env.BLACK_BEGONIA_RESPONSIVE_MATRIX === 'true';
  const responsiveChromeFlags = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-software-rasterizer',
    '--disable-features=Vulkan,UseSkiaRenderer',
    '--force-device-scale-factor=1',
  ];

  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      clearContext: false,
      jasmine: {},
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/black-begonia'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: responsiveMatrixEnabled
      ? [
          'ChromeHeadlessIPhone',
          'ChromeHeadlessAndroid',
          'ChromeHeadlessTablet',
          'ChromeHeadlessLaptop',
          'ChromeHeadlessDesktop',
          'ChromeHeadlessUltrawide',
        ]
      : ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: responsiveChromeFlags,
      },
      ChromeHeadlessIPhone: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=375,812'],
      },
      ChromeHeadlessAndroid: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=412,915'],
      },
      ChromeHeadlessTablet: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=768,1024'],
      },
      ChromeHeadlessLaptop: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=1280,800'],
      },
      ChromeHeadlessDesktop: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=1920,1080'],
      },
      ChromeHeadlessUltrawide: {
        base: 'ChromeHeadless',
        flags: [...responsiveChromeFlags, '--window-size=2560,1080'],
      },
    },
    restartOnFileChange: true,
  });
};
