$(function(){
    $(document).ready(function(){
        Content.initYyyymmStr();
        Content.addImportBtn();
        Content.addModalPage();
    });
    $(document).on("click", '#modal-open', function(){
         Content.showModalPage();
    });
    $(document).on("click", '#modal-overlay,#modal-close', function(){
        $("#modal-content,#modal-overlay").fadeOut("slow",function(){
            //フェードアウト後、[#modal-overlay]をHTML(DOM)上から削除
            $("#modal-overlay").remove();
        });
    });

    $(document).on("click", '#modal-loadBtn', function(){
         Content.loadContent();
    });
});

var YyyymmStr;

var Content = {
    // タイトルの「XXXX さん　yyyy年mm月勤怠管理」文字列から年月を取得する
    initYyyymmStr: function(){
        var str = $("h3.we-title").text();
        var index = str.indexOf('さん');
        str = str.slice(index + 3);
        year = str.substring(0, 4);
        month = str.substring(5, 7);
        YyyymmStr = year + month;
    },
    addImportBtn: function(){
        var $btnP = $('<span>').html('&nbsp;&nbsp;&nbsp;');
        var $btnA = $('<a>').attr({
            id:   'modal-open',
            class: 'button-link'
        }).text('インポート').appendTo($btnP);

        $("#register_report").after($btnP);

    },
    // モダル画面を生成
    addModalPage: function(){
        var $modalDiv = $('<div>').attr({
            id:     'modal-content',
            style:  'display:none;'
        });
        var $description = $('<p>').html(
                'Excelの勤務表（tsv, csv）をここに貼り付けて、取り込むことができます。<br>'
              + '１番目項目：日付（１～３１の半角数字を入力）<br>'
              + '２番目～　：勤務区分、始業時刻、終業時刻など<br>'
              + '区切り文字：タブ、カンマ'
        );

        var $placeholder = ""
+ "●入力例\n"
+ "# tsv\n"
+ "5	通常	09:00	18:00	01:00	00:00	00:00	備考です\n"
+ "\n"
+ "# csv\n"
+ "9,09:00,18:00\n"
+ "10,備考です。,9:00,18:00,01:00,00:00,00:00,通常\n"
+ "11,11:30,20:00,遅刻早退\n"
+ "20,有給\n"
;

        var $textArea = $('<textarea>').attr({
            id:     'input-area',
            rows:   20,
            cols:   65,
            placeholder: $placeholder
        });
        var $chkBox = $('<input>').attr({
            id:     'defaultFlag',
            type:   'checkbox',
            value:  '1',
            checked:'checked',
        });
        var $chkLabel = $('<label>').attr({
            id:    'label-defaultFlag',
            for:   'defaultFlag',
            style: 'font-size: 12px'
        }).html(
            '未入力項目は設定中の「定時（開始）」「定時（終了）」「休憩時間」をセット'
        );
        var $execBtn = $('<button>').attr({id: 'modal-loadBtn'}).text('load');

        $closeBtn = $('<a>').attr({
            id:     'modal-close',
            class:  'button-link'
        }).text('閉じる');

        $modalDiv
            .append($description)
            .append($chkBox)
            .append($chkLabel)
            .append($('<div>').attr({style: 'text-align: center;'}).append($textArea).append($('<div>').append($execBtn)))
            .append($closeBtn);
        $('body').append($modalDiv);
    },

    showModalPage: function(){

        //キーボード操作などにより、オーバーレイが多重起動するのを防止する
        //ボタンからフォーカスを外す
        $(this).blur() ;

        //新しくモーダルウィンドウを起動しない
        if($("#modal-overlay")[0]) return false;

        this.centeringModalSyncer();

        //オーバーレイ用のHTMLコードを、[body]内の最後に生成する
        $("body").append('<div id="modal-overlay"></div>');

        //[$modal-overlay]をフェードインさせる
        $("#modal-overlay").fadeIn("slow");

        $("#modal-content").fadeIn("slow");
    },

    //センタリングをする関数
    centeringModalSyncer: function(){

        //画面(ウィンドウ)の幅を取得し、変数[w]に格納
        var w = $(window).width();
        //画面(ウィンドウ)の高さを取得し、変数[h]に格納
        var h = $(window).height();

        //コンテンツ(#modal-content)の幅を取得し、変数[cw]に格納
        var cw = $("#modal-content").width();
        //コンテンツ(#modal-content)の高さを取得し、変数[ch]に格納
        var ch = $("#modal-content").height();

        //コンテンツ(#modal-content)を真ん中に配置するのに、左端から何ピクセル離せばいいか？を計算して、変数[pxleft]に格納
        var pxleft = ((w - cw)/2);
        //コンテンツ(#modal-content)を真ん中に配置するのに、上部から何ピクセル離せばいいか？を計算して、変数[pxtop]に格納
        var pxtop = 70;

        //[#modal-content]のCSSに[left]の値(pxleft)を設定
        $("#modal-content").css({"left": pxleft + "px"});
        //[#modal-content]のCSSに[top]の値(pxtop)を設定
        $("#modal-content").css({"top": pxtop + "px"});
    },

    loadContent: function(){
        var formValueList = [];
        var returnStr = '';
        var lines = $('#input-area').val().split('\n');

        for(var i=0;i<lines.length;i++){
            line =  jQuery.trim(lines[i]);
            if (line == '') { continue; }

            var result = this.parseLines(line);

            if ($.type(result) === "string") {
                returnStr += result;
            } else {
                formValueList.push(result);
            }
        }

        // エラーメッセージの書き込み
        $('#input-area').val(returnStr);
        // Formに値を反映
        this.reflectToForm(formValueList);
    },
    parseLines: function(line){
        if (line.match(/^#/)) {
            // ＃ から始まる文字列は取り込まない（エラー行の扱い）
            return line;
        }

        // 0:start_time(始業), 1:end_time(終業), 2:on_time_break(定時内休憩), 3:non_scheduled_break(定時後休憩（深夜外）), 4:midnight_break(定時後休憩（深夜内）)
        var timeIndex = 0;
        var resultHash = {};
        var cols = line.split(/\t|,/);

        var day = cols[0].length == 1 ? '0'+cols[0] : cols[0];
        var biko = '';

        if(isNaN(day) || ! $(':text[name='+YyyymmStr+day+'\\[start_time\\]]').length){
            return '#error:' + line + '   //１番目の項目は有効な日ではありません。' + "\n";
        }

        // 2番目の項目からループ
        for(var i=1;i<cols.length;i++){
            colVal =  jQuery.trim(cols[i]);
            if (colVal == '') { continue; }

            // 時間形式の文字列の場合
            if (colVal.match(/^[0-9]{1,2}:[0-9]{1,2}$/)) {
                switch (timeIndex){
                    case 0:
                        resultHash[YyyymmStr+day+'\\[start_time\\]'] = colVal;
                        break;
                    case 1:
                        resultHash[YyyymmStr+day+'\\[end_time\\]'] = colVal;
                        break;
                    case 2:
                        resultHash[YyyymmStr+day+'\\[on_time_break\\]'] = colVal;
                        break;
                    case 3:
                        resultHash[YyyymmStr+day+'\\[non_scheduled_break\\]'] = colVal;
                        break;
                    case 4:
                        resultHash[YyyymmStr+day+'\\[midnight_break\\]'] = colVal;
                        break;
                    default:
                        // ５項目以降は無視
                        break;
                }
                timeIndex++;
                continue;
            }

            // 勤務区分の要素の場合
            var selVal = this.getSelValue(colVal, day);
            if (selVal !== '') {
                resultHash[YyyymmStr+day+'\\[mst_work_kbn_id\\]'] = selVal;
                continue;
            }

            // 時間、勤務区分ともなければ、備考の扱い
            biko += colVal;
        }

        if (biko !== '') {
            resultHash[YyyymmStr+day+'\\[remarks\\]'] = biko;
        }


        // チェック反映用基本データを反映する（平日のみ）
        if($("#defaultFlag:checked").val() && this.isWeekday(day)) {
            resultHash = this.setDefaultVal(day, resultHash);
        }

        return resultHash;
    },
    // 勤務区分の value を取得
    getSelValue: function(colVal, day) {
        var obj = $('select[name='+YyyymmStr+day+'\\[mst_work_kbn_id\\]]').children();
        for( var i=0; i<obj.length; i++ ){
            if (jQuery.trim(obj.eq(i).text()) === colVal) {
                return obj.eq(i).val();
            }
        }
        return '';
    },
    // <tr>要素の class を元に平日かを判定する
    isWeekday:function(day) {
        $tr = $(':text[name='+YyyymmStr+day+'\\[start_time\\]]').parents('tr');
        var tr_class = jQuery.trim($tr.attr("class"));
        if(tr_class == 'info' || tr_class == 'danger') {
            return false;
        }
        return true;
    },
    // 時間欄に「チェック反映用基本データ」を反映して良いか判定する
    isSetDefaultTime:function(selVal) {
        // 勤務区分が '通常','遅刻早退','半休' 以外の場合
        if ($.inArray(selVal, ['1','2','5']) == -1) {
            return false;
        }
        return true;
    },
    // 未入力項目に設定中の「定時（開始）」「定時（終了）」「休憩時間」を反映、「定時後休憩（深夜外）」「定時後休憩（深夜内）」には 00:00 をセット
    setDefaultVal: function(day, resultHash) {
        // 勤務区分が未入力の場合
        if ((YyyymmStr+day+'\\[mst_work_kbn_id\\]' in resultHash) === false) {
            // "1:通常"をセットする
            resultHash[YyyymmStr+day+'\\[mst_work_kbn_id\\]'] = '1';
        }

        if (this.isSetDefaultTime(resultHash[YyyymmStr+day+'\\[mst_work_kbn_id\\]'])) {

            if ((YyyymmStr+day+'\\[start_time\\]' in resultHash) === false) {
                resultHash[YyyymmStr+day+'\\[start_time\\]'] = $('input[name=regular_start_time]').val();
            }
            if ((YyyymmStr+day+'\\[end_time\\]' in resultHash) === false) {
                resultHash[YyyymmStr+day+'\\[end_time\\]'] = $('input[name=regular_end_time]').val();
            }
            if ((YyyymmStr+day+'\\[on_time_break\\]' in resultHash) === false) {
                resultHash[YyyymmStr+day+'\\[on_time_break\\]'] = $('input[name=regular_break_time]').val();
            }
            if ((YyyymmStr+day+'\\[non_scheduled_break\\]' in resultHash) === false) {
                resultHash[YyyymmStr+day+'\\[non_scheduled_break\\]'] = '00:00';
            }
            if ((YyyymmStr+day+'\\[midnight_break\\]' in resultHash) === false) {
                resultHash[YyyymmStr+day+'\\[midnight_break\\]'] = '00:00';
            }
        }

        return resultHash;
    },
    // フォームの要素に値を反映する
    reflectToForm: function(formValueList) {
        for( var i=0; i<formValueList.length; i++ ) {
            var row = formValueList[i];

            $.each( row, function( key, value ) {
                if (key.match(/mst_work_kbn_id/)) {
                    $('select[name='+key+']').val(value);

                    // 画面表示用文言(obj.text())に一致する要素の値(obj.var())を選択する
//                    var obj = $('select[name='+key+']').children();
//                    for( var i=0; i<obj.length; i++ ){
//                        if ( value == obj.eq(i).text() ) {
//                            $('select[name='+key+']').val(value);
//                        }
//                    }
                } else {
                    $(':text[name="'+key+'"]').val(value);
                }
            });
        }
        // 反映後合計時間を再計算する
        //$('input[value=再計算]').click();
    }
};
