'use strict';

angular.module('tabHelper', ['ngFileUpload', 'ui.checkbox']).controller('TabHelperOptionsController',
  ['$scope', '$timeout', 'Upload', '$http', function ($scope, $timeout, Upload, $http) {
    var vm = $scope;

    var OPTIONS_KEY = 'TAB_HELPER_OPTIONS';
    var TAB_HELPER_TEMPLATE_URL = 'TAB_HELPER_TEMPLATE_URL';

    var PAGE_LOADING_OFFSET = 1100;
    var PAGE_DETECTION_DISPLAY_INTERVAL = 3;//3 seconds

    var POSITIONS = {
      CENTER: {id: 'center', name: 'center'},
      LEFT_HALF: {id: 'left-half', name: 'left-half'},
      RIGHT_HALF: {id: 'right-half', name: 'right-half'},
      TOP_HALF: {id: 'top-half', name: 'top-half'},
      BOTTOM_HALF: {id: 'bottom-half', name: 'bottom-half'}
    };

    var MONITORS = {};

    vm.POSITIONS = POSITIONS;
    vm.MONITORS = MONITORS;

    vm.options = null;
    vm.showNewTabOption = false;
    vm.showEditTabOption = false;
    vm.showImportTemplateDialog = false;
    vm.inconsistentOptions = false;
    vm.dirty = false;
    vm.showExtraOptions = false;
    vm.isopen = true;
    vm.showImportTemplateDialog = false;
    vm.templateUrl = '';

    vm.markAsDirty = markAsDirk;
    vm.saveOptions = saveOptions;
    vm.loadOptions = loadOptions;
    vm.reloadOptions = reloadOptions;
    vm.detectMonitors = detectMonitors;
    vm.showAdvancedOptions = showAdvancedOptions;
    vm.addTabOption = addTabOption;
    vm.saveTabOption = saveTabOption;
    vm.updateTabOption = updateTabOption;
    vm.editTabOption = editTabOption;
    vm.useTemplateAsOption = useTemplateAsOption;

    vm.autofixOptions = autofixOptions;
    vm.validateOptions = validateOptions;

    vm.moveOptionUp = moveOptionUp;
    vm.moveOptionDown = moveOptionDown;

    vm.importTemplate = importTemplate;
    vm.openImportTemplateMenu = openImportTemplateMenu;
    vm.acceptImportTemplateMenu = acceptImportTemplateMenu;
    vm.cancelImportTemplateMenu = cancelImportTemplateMenu;
    vm.exportTemplate = exportTemplate;

    vm.cancelTabOption = cancelTabOption;

    vm.deleteTabOption = deleteTabOption;

    activate();

    //////////////////////////////////////////////////////////////////


    function activate() {
      loadOptions();
      loadDisplayInfos();
    }

    function showAdvancedOptions() {
      vm.showExtraOptions = !vm.showExtraOptions;
    }

    function loadDisplayInfos() {
      chrome.system.display.getInfo(function (displayInfos) {
        vm.displayInfos = angular.copy(displayInfos);
        console.table(displayInfos);
        _.forEach(vm.displayInfos, function (display, idx) {
          display.idx = idx + 1;
          var monitor = {
            id: display.id,
            idx: display.idx,
            name: display.idx + ' ' + display.name,
            workArea: display.workArea
          };
          MONITORS[monitor.id] = monitor;
        });
        $timeout(function () {
          validateOptions();
        });
      });
    }

    function detectMonitors() {
      _.forEach(vm.displayInfos, function (display, idx) {
        var detectionUrl =
          'https://igorlino.github.io/page-generator/? ' +
          'title=Monitor%20' + (idx + 1) +
          '&type=monitor&id=' + (idx + 1) +
          '&delay=' + PAGE_DETECTION_DISPLAY_INTERVAL;
        var createData = {
          url: detectionUrl,
          left: display.workArea.left,
          top: display.workArea.top,
          width: display.workArea.width,
          height: display.workArea.height,
          type: 'popup'
        };
        chrome.windows.create(createData, function onWindowsCreated(window) {
          console.log('Window ' + window.id + ' created.');
          setTimeout(function () {
            console.log('Removing window ' + window.id);
            chrome.windows.remove(window.id, function () {
              console.log('Removed window ' + window.id);
            });
          }, (PAGE_DETECTION_DISPLAY_INTERVAL * 1000) + PAGE_LOADING_OFFSET); //+800ms to offset detect page loading
        });
      });
    }

    function getPrimaryDisplay() {
      var found = null;
      _.forEach(vm.displayInfos, function (display, idx) {
        if (display.isPrimary) {
          found = display;
          return false;
        }
      });
      return found;
    }

    function getDisplayById(id) {
      var found = null;
      _.forEach(vm.displayInfos, function (display, idx) {
        if (display.id === id) {
          found = display;
          return false;
        }
      });
      return found;
    }

    function deleteTabOption(tabOption) {
      _.remove(vm.options.tabs, function (option) {
        return option.timestamp === tabOption.timestamp;
      });
      markAsDirk();
    }

    function addTabOption() {
      vm.showNewTabOption = true;
      vm.newTabOption = createNewOption();
      vm.newTabOption.template = null;
    }

    function editTabOption(tabOption) {
      vm.showEditTabOption = true;
      vm.newTabOption = angular.copy(tabOption);
      vm.newTabOption.position = findPositionById(tabOption.position);
      vm.newTabOption.monitor = getDisplayById(tabOption.monitor.id);
      vm.editTabOptionIdx = _.findIndex(vm.options.tabs, tabOption);
      vm.newTabOption.template = null;
    }

    function useTemplateAsOption() {
      if (vm.newTabOption.template) {
        vm.newTabOption.name = vm.newTabOption.template.name;
        vm.newTabOption.url = vm.newTabOption.template.url;
        vm.newTabOption.code = vm.newTabOption.template.code;
        vm.newTabOption.active = vm.newTabOption.template.active;
        vm.newTabOption.remember = vm.newTabOption.template.remember;
      }
    }

    function findPositionById(positionId) {
      var positionKey = _.findKey(POSITIONS, function (position) {
        return position.id === positionId;
      });
      return positionKey ? POSITIONS[positionKey] : null;
    }

    function cancelTabOption() {
      vm.showNewTabOption = false;
      vm.showEditTabOption = false;
    }

    function updateTabOption() {
      vm.showEditTabOption = false;
      vm.options.tabs[vm.editTabOptionIdx] = {
        active: vm.newTabOption.active,
        code: vm.newTabOption.code,
        remember: vm.newTabOption.remember,
        url: vm.newTabOption.url,
        name: vm.newTabOption.name,
        monitor: vm.newTabOption.monitor,
        fullScreen: vm.newTabOption.fullScreen,
        popup: vm.newTabOption.popup,
        position: vm.newTabOption.position ? vm.newTabOption.position.id : 'center',
        timestamp: new Date().toISOString()
      };
      vm.editTabOptionIdx = -1;
      validateOptions();
      markAsDirk();
    }

    function saveTabOption() {
      vm.options.tabs.push({
        active: vm.newTabOption.active,
        code: vm.newTabOption.code,
        remember: vm.newTabOption.remember,
        url: vm.newTabOption.url,
        name: vm.newTabOption.name,
        monitor: vm.newTabOption.monitor,
        fullScreen: vm.newTabOption.fullScreen,
        popup: vm.newTabOption.popup,
        position: vm.newTabOption.position ? vm.newTabOption.position.id : 'center',
        timestamp: new Date().toISOString()
      });
      vm.showNewTabOption = false;
      validateOptions();
      markAsDirk();
    }

    function saveOptions() {
      localStorage[OPTIONS_KEY] = JSON.stringify(vm.options);
      markAsPristine();
      chrome.tabs.getCurrent(function (tab) {
        chrome.tabs.remove(tab.id, function () {
        });
      });
    }

    function markAsDirk() {
      vm.dirty = true;
    }

    function markAsPristine() {
      vm.dirty = false;
    }

    function loadOptions() {
      var tabRuleOptions = localStorage[OPTIONS_KEY];
      if (tabRuleOptions) {
        vm.options = JSON.parse(tabRuleOptions);
        markAsPristine();
      } else {
        vm.options = {
          tabs: []
        };
        markAsDirk();
      }
      if (vm.options.templates) {
        vm.options.templates = getDefaultTemplates();
      }
      return vm.options;
    }

    function reloadOptions() {
      loadOptions();
      validateOptions();
    }

    function validateOptions() {
      var missing = false;
      _.forEach(vm.options.tabs, function (tab, idx) {
        var found = false;
        _.forEach(vm.displayInfos, function (display, idx) {
          if (display.isEnabled && tab.monitor.id === display.id) {
            found = true;
            return false;
          }
        });
        if (!found) {
          tab.inconsistentMonitor = true;
          missing = true;
        } else {
          tab.inconsistentMonitor = false;
        }
      });
      vm.inconsistentOptions = missing;
    }

    function autofixOptions() {
      var primaryDisplay = getPrimaryDisplay();
      _.forEach(vm.options.tabs, function (tab, idx) {
        var found = false;
        var closestMatch = null;
        _.forEach(vm.displayInfos, function (display, idx) {
          if (display.isEnabled && display.workArea &&
            display.workArea.height === tab.monitor.workArea.height &&
            display.workArea.width === tab.monitor.workArea.width) {
            closestMatch = display;
          }
          if (tab.monitor.id === display.id) {
            found = true;
            return false;
          }
        });
        if (!found) {
          if (closestMatch) {
            replaceMonitor(tab.monitor, closestMatch);
          } else if (primaryDisplay) {
            replaceMonitor(tab.monitor, primaryDisplay);
          }
          //monitor: vm.newTabOption.monitor,
          //position: vm.newTabOption.position.id,
        }
      });

      validateOptions();

      function replaceMonitor(target, sourceDisplay) {
        target.workArea = angular.copy(sourceDisplay.workArea);
        target.id = sourceDisplay.id;
        var idx = _.findIndex(vm.displayInfos, sourceDisplay);
        target.name = (idx + 1) + ' ' + sourceDisplay.name;
      }
    }

    function createNewOption() {
      return {
        active: true,
        remember: false,
        code: 'custom',
        name: 'Option Name Here',
        url: 'http://any.url/',
        monitor: getPrimaryDisplay(),
        fullScreen: false,
        popup: true,
        position: POSITIONS.CENTER
      };
    }

    function openImportTemplateMenu() {
      var templateUrl = localStorage[TAB_HELPER_TEMPLATE_URL];
      if (templateUrl) {
        vm.templateUrl = templateUrl;
      }
      vm.showImportTemplateDialog = true;
    }

    function acceptImportTemplateMenu(templateUrl) {
      vm.showImportTemplateDialog = false;
      if (templateUrl && templateUrl !== '') {
        localStorage[TAB_HELPER_TEMPLATE_URL] = templateUrl;
        vm.templateUrl = templateUrl;

        callHttpByGet(templateUrl, function onResponse(response) {
          if (response.success && response.data) {
            if (response.data.tabs) {
              vm.options.tabs = response.data.tabs;
            }
            if (response.data.templates) {
              vm.options.templates = response.templates;
            }
            validateOptions();
          }
        });
      }
    }

    function cancelImportTemplateMenu() {
      vm.showImportTemplateDialog = false;
      vm.templateUrl = '';
    }

    function importTemplate(file) {
      Upload.upload({
        url: 'upload/url',
        data: {file: file, 'username': $scope.username}
      }).then(function (resp) {
        console.log('Success ' + resp.config.data.file.name + 'uploaded. Response: ' + resp.data);
      }, function (resp) {
        console.log('Error status: ' + resp.status);
      }, function (evt) {
        var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
        if (evt.config.data.file.name) {
          console.log('progress: ' + progressPercentage + '% ' + evt.config.data.file.name);
        } else {
          console.log('progress: ' + progressPercentage + '% ' + evt.config.data.file);
        }
      });
    }

    function exportTemplate() {
      var optionsAsJson = angular.toJson(vm.options, 3);
      var blob = new Blob([optionsAsJson], {type: 'application/json'});
      var saveAs = window.saveAs;
      saveAs(blob, 'tab-helper-options-export.json');
    }

    function getDefaultTemplates() {
      return [
        {
          active: true,
          remember: false,
          name: 'Google Search',
          url: 'https://www.google.com/',
          code: 'google-search'
        },
        {
          active: true,
          remember: false,
          name: 'Facebook',
          url: 'https://www.facebook.com',
          code: 'facebook'
        },
        {
          active: true,
          remember: false,
          name: 'YouTube',
          url: 'https://www.youtube.com/',
          code: 'google-youtube'
        },
        {
          active: true,
          remember: false,
          name: 'Wikipedia',
          url: 'https://www.wikipedia.org/',
          code: 'wikipedia'
        },
        {
          active: true,
          remember: false,
          name: 'Amazon',
          url: 'https://www.amazon.com/',
          code: 'amazon-global'
        },
        {
          active: true,
          remember: false,
          name: 'Ebay',
          url: 'http://www.ebay.com/',
          code: 'ebay-global'
        }
      ]
    }

    function moveOptionUp(first, index) {
      if (!first) {
        swap(vm.options.tabs, index, index - 1);
        markAsDirk();
      }
    }

    function moveOptionDown(last, index) {
      if (!last) {
        swap(vm.options.tabs, index, index + 1);
        markAsDirk();
      }
    }

    function swap(list, idx1, idx2) {
      var tmp = list[idx1];
      list[idx1] = list[idx2];
      list[idx2] = tmp;
    }

    function callHttpByGet(callPath, callback) {
      $http({
        method: 'get',
        url: callPath,
      })
        .success(function (data, status, headers, config) {
          var response =
          {
            success: true,
            data: data
          };

          callback(response);
        })
        .error(function (data, status, headers, config) {
          var response = handleHttpError(data, callPath);
          callback(response);
        });
    }

    function handleHttpError(data, callPath) {
      var response = {success: false};
      if (data) {
        response.error = data;
      }
      else {
        response.error = dateNow() + ' - Request failed: ' + callPath;
      }
      return response;
    }

    function dateNow() {
      var d = new Date();
      return d.toLocaleString();
    }
  }]);