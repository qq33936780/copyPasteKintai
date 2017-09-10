$(function(){
    $(document).ready(function(){
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

var Content = {
    addImportBtn: function(){
        var $btnP = $('<span>').html('&nbsp;&nbsp;&nbsp;');
        var $btnA = $('<a>').attr({
            id:   'modal-open',
            class: 'button-link'
        }).text('インポート').appendTo($btnP);

        $('[type="button"][value="再計算"]').after($btnP);


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
              + '２番目～　：休日フラグ、始業、終業など<br>'
              + '区切り文字：タブ、カンマ'
        );

        var $placeholder = ""
+ "●入力例\n"
+ "# tsv\n"
+ "5	通常	9:00	18:00	1:00	0:00	0:00	備考です\n"
+ "\n"
+ "# csv\n"
+ "7,備考です。,9:00,18:00,1:00,0:00,0:00,通常\n"
+ "8,11:30,20:00,遅刻早退\n"
+ "20,有給\n"
+ "21,9:00,18:00\n"
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
        }).html('未入力項目は「チェック反映用基本データ」をセット (チェック中の日付のみが対象)');
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

        // 0:start(始業), 1:end(終業), 2:teiji(定時内休憩), 3:sinya(定時後休憩), 4:sinyanai(深夜休憩)
        var timeIndex = 0;
        var resultHash = {};
        var cols = line.split(/\t|,/);

        if(isNaN(cols[0]) || cols[0] <= 0 || cols[0] > 31 || ! $(':text[name="start'+cols[0]+'"]').length){
            return '#error:' + line + '   //１番目の項目は有効な日ではありません。' + "\n";
        }

        var day = cols[0];
        var biko = '';

        // 2番目の項目からループ
        for(var i=1;i<cols.length;i++){
            colVal =  jQuery.trim(cols[i]);
            if (colVal == '') { continue; }

            if (colVal.match(/^[0-9]{1,2}:[0-9]{1,2}$/)) {
                switch (timeIndex){
                    case 0:
                        resultHash['start'+day] = colVal;
                        break;
                    case 1:
                        resultHash['end'+day] = colVal;
                        break;
                    case 2:
                        resultHash['teiji'+day] = colVal;
                        break;
                    case 3:
                        resultHash['sinya'+day] = colVal;
                        break;
                    case 4:
                        resultHash['sinyanai'+day] = colVal;
                        break;
                    default:
                        // ５項目目からは無視
                        break;
                }
                timeIndex++;
                continue;
            }

            if (this.isMatchSel(colVal, day)) {
                resultHash['sel'+day] = colVal;
                continue;
            }

            // 時間、休日フラグともなければ、備考の扱い
            biko += colVal;
        }

        if (biko !== '') {
            resultHash['biko'+day] = biko;
        }

        // チェック反映用基本データを反映する（平日のみ）
        if($("#defaultFlag:checked").val() && $('input[name=chk'+day+']:checked').val()) {
            resultHash = this.setDefaultVal(day, resultHash);
        }
        return resultHash;
    },
    // 休日フラグと一致する文字列かを判定する
    isMatchSel: function(colVal, day) {
        var obj = $('select[name=sel'+day+']').children();
        for( var i=0; i<obj.length; i++ ){
            if (obj.eq(i).val() === colVal) {
                return true;
            }
        }
        return false;
    },
    // 未入力項目に「チェック反映用基本データ」を反映
    setDefaultVal: function(day, resultHash) {
        // 休日フラグ
        if (('sel'+day in resultHash) === false) {
            resultHash['sel'+day] = $('select[name=selAll]').val();
        }

        // 始業
        if (('start'+day in resultHash) === false) {
            resultHash['start'+day] = $('input[name=startAll]').val();
        }

        var itemList = ['start', 'end', 'teiji', 'sinya', 'sinyanai'];
        $.each(itemList, function(i, item) {
            if ((item + day in resultHash) === false) {
                resultHash[item + day] = $('input[name='+item+'All]').val();
            }
        });


        return resultHash;
    },
    // フォームの要素に値を反映する
    reflectToForm: function(formValueList) {
        for( var i=0; i<formValueList.length; i++ ) {
            var row = formValueList[i];

            $.each( row, function( key, value ) {
                if (key.match(/^sel[0-9]{1,2}$/)) {
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
        $('input[value=再計算]').click();
    }
};
