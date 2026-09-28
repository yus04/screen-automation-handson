(function () {
  "use strict";

  var STORAGE_KEY = "scm-core.orders";

  var FIELDS = [
    { name: "orderNumber", label: "注文番号", required: true },
    { name: "orderDate", label: "受注日", required: true },
    { name: "customerCode", label: "取引先", required: true, fromSelect: true },
    { name: "deliveryDate", label: "納品希望日", required: false },
    { name: "productCode", label: "商品コード", required: true, fromSelect: true },
    { name: "quantity", label: "数量", required: true, numeric: true },
    { name: "unitPrice", label: "単価 (円)", required: true, numeric: true },
    { name: "currency", label: "通貨", required: false, fromSelect: true },
    { name: "paymentTerms", label: "支払条件", required: true },
    { name: "shippingMethod", label: "出荷方法", required: false },
    { name: "picName", label: "担当者名", required: false },
    { name: "inspectionRequired", label: "検収要否", required: false },
    { name: "remarks", label: "備考", required: false }
  ];

  var form = document.getElementById("order-form");
  var screens = {
    input: document.getElementById("screen-input"),
    confirm: document.getElementById("screen-confirm"),
    complete: document.getElementById("screen-complete")
  };
  var formError = document.getElementById("form-error");
  var confirmBody = document.getElementById("confirm-body");
  var storedOrdersBody = document.getElementById("stored-orders");
  var completeMessage = document.getElementById("complete-message");

  var pendingOrder = null;

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== name;
    });
    window.scrollTo(0, 0);
  }

  function getElement(name) {
    return form.elements[name];
  }

  function readValue(name) {
    var el = getElement(name);
    if (!el) {
      return "";
    }
    if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
      return el.value;
    }
    if (el.type === "checkbox") {
      return el.checked;
    }
    return typeof el.value === "string" ? el.value.trim() : el.value;
  }

  function selectedLabel(name) {
    var el = getElement(name);
    if (!el || !el.options || el.selectedIndex < 0) {
      return "";
    }
    var option = el.options[el.selectedIndex];
    return option && option.value ? option.textContent.trim() : "";
  }

  function setFieldError(name, message) {
    var messageEl = form.querySelector('[data-error-for="' + name + '"]');
    if (messageEl) {
      messageEl.textContent = message || "";
    }
    var el = getElement(name);
    if (el && el.classList) {
      el.classList.toggle("is-invalid", Boolean(message));
    }
  }

  function clearErrors() {
    FIELDS.forEach(function (field) {
      setFieldError(field.name, "");
    });
    formError.hidden = true;
    formError.textContent = "";
  }

  function collect() {
    var data = {};
    FIELDS.forEach(function (field) {
      data[field.name] = readValue(field.name);
      if (field.fromSelect) {
        data[field.name + "Label"] = selectedLabel(field.name);
      }
    });
    return data;
  }

  function validate(data) {
    var errors = [];

    FIELDS.forEach(function (field) {
      if (!field.required) {
        return;
      }
      if (data[field.name] === "" || data[field.name] === null) {
        setFieldError(field.name, field.label + "は必須項目です。");
        errors.push(field.label);
      }
    });

    ["quantity", "unitPrice"].forEach(function (name) {
      var raw = data[name];
      if (raw === "") {
        return;
      }
      var value = Number(raw);
      if (!isFinite(value) || value < 0) {
        setFieldError(name, "0 以上の数値を入力してください。");
        errors.push(name);
      } else if (name === "quantity" && value < 1) {
        setFieldError(name, "数量は 1 以上を入力してください。");
        errors.push(name);
      }
    });

    if (data.orderDate && data.deliveryDate && data.deliveryDate < data.orderDate) {
      setFieldError("deliveryDate", "納品希望日は受注日以降の日付を指定してください。");
      errors.push("deliveryDate");
    }

    return errors;
  }

  function formatNumber(value) {
    var number = Number(value);
    return isFinite(number) ? number.toLocaleString("ja-JP") : String(value);
  }

  function amountOf(data) {
    return Number(data.quantity) * Number(data.unitPrice);
  }

  function displayValue(field, data) {
    var value = data[field.name];
    if (field.name === "inspectionRequired") {
      return value ? "必要" : "不要";
    }
    if (field.fromSelect) {
      return data[field.name + "Label"] || "(未入力)";
    }
    if (field.numeric && value !== "") {
      return formatNumber(value);
    }
    return value === "" ? "(未入力)" : String(value);
  }

  function renderConfirm(data) {
    confirmBody.innerHTML = "";
    FIELDS.forEach(function (field) {
      var row = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = field.label + (field.required ? " *" : "");
      var td = document.createElement("td");
      td.textContent = displayValue(field, data);
      td.setAttribute("data-confirm-for", field.name);
      row.appendChild(th);
      row.appendChild(td);
      confirmBody.appendChild(row);
    });

    var amountRow = document.createElement("tr");
    var amountTh = document.createElement("th");
    amountTh.scope = "row";
    amountTh.textContent = "合計金額";
    var amountTd = document.createElement("td");
    amountTd.setAttribute("data-confirm-for", "amount");
    amountTd.textContent = formatNumber(amountOf(data)) + " " + (data.currency || "JPY");
    amountRow.appendChild(amountTh);
    amountRow.appendChild(amountTd);
    confirmBody.appendChild(amountRow);
  }

  function loadOrders() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveOrders(orders) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
      return true;
    } catch (e) {
      return false;
    }
  }

  function renderStoredOrders() {
    var orders = loadOrders();
    storedOrdersBody.innerHTML = "";

    if (orders.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.className = "is-empty";
      emptyCell.textContent = "登録済みのデータはありません。";
      emptyRow.appendChild(emptyCell);
      storedOrdersBody.appendChild(emptyRow);
      return;
    }

    orders.forEach(function (order) {
      var row = document.createElement("tr");
      [
        order.registeredAt,
        order.orderNumber,
        order.customerCodeLabel || order.customerCode,
        order.productCodeLabel || order.productCode,
        formatNumber(order.quantity),
        formatNumber(order.unitPrice),
        formatNumber(amountOf(order)) + " " + (order.currency || "JPY")
      ].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      storedOrdersBody.appendChild(row);
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearErrors();

    var data = collect();
    var errors = validate(data);

    if (errors.length > 0) {
      formError.textContent = "入力内容に誤りがあります。必須項目 (*) およびエラーメッセージをご確認ください。";
      formError.hidden = false;
      return;
    }

    pendingOrder = data;
    renderConfirm(data);
    showScreen("confirm");
  });

  document.getElementById("back-button").addEventListener("click", function () {
    showScreen("input");
  });

  document.getElementById("commit-button").addEventListener("click", function () {
    if (!pendingOrder) {
      showScreen("input");
      return;
    }

    var orders = loadOrders();
    var record = Object.assign({}, pendingOrder, {
      registeredAt: new Date().toLocaleString("ja-JP")
    });
    orders.unshift(record);

    if (!saveOrders(orders)) {
      completeMessage.textContent = "登録に失敗しました。ブラウザのストレージをご確認ください。";
    } else {
      completeMessage.textContent =
        "受発注データを登録しました。受付番号: " + record.orderNumber + " (登録日時: " + record.registeredAt + ")";
    }

    pendingOrder = null;
    form.reset();
    clearErrors();
    renderStoredOrders();
    showScreen("complete");
  });

  document.getElementById("new-entry-button").addEventListener("click", function () {
    showScreen("input");
  });

  document.getElementById("clear-button").addEventListener("click", function () {
    window.setTimeout(clearErrors, 0);
  });

  document.getElementById("clear-storage-button").addEventListener("click", function () {
    if (window.confirm("ブラウザに保存されている受発注データをすべて削除します。よろしいですか?")) {
      window.localStorage.removeItem(STORAGE_KEY);
      renderStoredOrders();
    }
  });

  document.getElementById("today").textContent = new Date().toLocaleDateString("ja-JP");
  renderStoredOrders();
  showScreen("input");
})();
