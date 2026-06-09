from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime, timedelta
import base64

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"]}})

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sleep_monitor.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True)
    phone = db.Column(db.String(20))
    age = db.Column(db.Integer)
    height = db.Column(db.Float)
    weight = db.Column(db.Float)
    avatar = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.now)

class Device(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    status = db.Column(db.String(20), default='offline')
    battery = db.Column(db.Integer, default=0)
    signal = db.Column(db.Integer)
    sample_rate = db.Column(db.Integer, default=100)
    signal_threshold = db.Column(db.Integer, default=-60)
    alert_enabled = db.Column(db.Boolean, default=True)
    upload_enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

class SleepRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    device_id = db.Column(db.String(80))
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    duration = db.Column(db.Float)
    efficiency = db.Column(db.Float)
    score = db.Column(db.Integer)
    deep_sleep = db.Column(db.Float)
    light_sleep = db.Column(db.Float)
    rem_sleep = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.now)

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    device_id = db.Column(db.String(80))
    alert_type = db.Column(db.String(50), nullable=False)
    level = db.Column(db.String(20), default='P2')
    message = db.Column(db.String(200))
    status = db.Column(db.String(20), default='unhandled')
    created_at = db.Column(db.DateTime, default=datetime.now)

class Respiration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    device_id = db.Column(db.String(80))
    respiration_rate = db.Column(db.Float, nullable=False)
    confidence = db.Column(db.Float)
    motion_detected = db.Column(db.Boolean, default=False)
    sleep_state = db.Column(db.String(20))
    timestamp = db.Column(db.DateTime, default=datetime.now)

class EnvironmentRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    device_id = db.Column(db.String(80))
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.now)

class Alarm(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    title = db.Column(db.String(100), nullable=False)
    time = db.Column(db.Time, nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    repeat_days = db.Column(db.String(50), default='')
    sound = db.Column(db.String(100), default='default')
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_triggered = db.Column(db.DateTime)

@app.route('/')
def index():
    return jsonify({'message': '睡眠监测系统后端API', 'version': '1.0.0', 'status': 'running'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username, password=password).first()
    
    if user:
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'phone': user.phone,
                'avatar': user.avatar
            }
        })
    else:
        return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if User.query.filter_by(username=data.get('username')).first():
        return jsonify({'success': False, 'message': '用户名已存在'}), 400
    
    user = User(
        username=data.get('username'),
        password=data.get('password'),
        email=data.get('email'),
        phone=data.get('phone'),
        age=data.get('age'),
        height=data.get('height'),
        weight=data.get('weight')
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'success': True, 'message': '注册成功'})

@app.route('/api/user/<int:user_id>', methods=['GET', 'PUT'])
def user_profile(user_id):
    user = User.query.get_or_404(user_id)
    
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'data': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'phone': user.phone,
                'age': user.age,
                'height': user.height,
                'weight': user.weight,
                'avatar': user.avatar
            }
        })
    else:
        data = request.get_json()
        user.email = data.get('email', user.email)
        user.phone = data.get('phone', user.phone)
        user.age = data.get('age', user.age)
        user.height = data.get('height', user.height)
        user.weight = data.get('weight', user.weight)
        user.avatar = data.get('avatar', user.avatar)
        
        db.session.commit()
        return jsonify({'success': True, 'message': '更新成功'})

@app.route('/api/user/<int:user_id>/avatar', methods=['POST'])
def upload_avatar(user_id):
    user = User.query.get_or_404(user_id)
    
    data = request.get_json()
    avatar_base64 = data.get('avatar')
    
    if not avatar_base64:
        return jsonify({'success': False, 'message': '请选择图片'}), 400
    
    try:
        if avatar_base64.startswith('data:image/'):
            avatar_base64 = avatar_base64.split(',')[1]
        
        avatar_data = base64.b64decode(avatar_base64)
        
        avatar_dir = os.path.join(os.path.dirname(__file__), 'uploads/avatars')
        os.makedirs(avatar_dir, exist_ok=True)
        
        avatar_filename = f'{user_id}_{datetime.now().strftime("%Y%m%d%H%M%S")}.jpg'
        avatar_path = os.path.join(avatar_dir, avatar_filename)
        
        with open(avatar_path, 'wb') as f:
            f.write(avatar_data)
        
        user.avatar = f'/uploads/avatars/{avatar_filename}'
        db.session.commit()
        
        return jsonify({'success': True, 'avatar': user.avatar})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/user/<int:user_id>/profile-complete', methods=['GET'])
def check_profile_complete(user_id):
    user = User.query.get_or_404(user_id)
    
    is_complete = all([
        user.age is not None,
        user.height is not None,
        user.weight is not None,
        user.phone is not None
    ])
    
    return jsonify({
        'success': True,
        'complete': is_complete,
        'missing_fields': {
            'age': user.age is None,
            'height': user.height is None,
            'weight': user.weight is None,
            'phone': user.phone is None
        }
    })

@app.route('/uploads/avatars/<filename>')
def serve_avatar(filename):
    avatar_dir = os.path.join(os.path.dirname(__file__), 'uploads/avatars')
    return send_from_directory(avatar_dir, filename)

import requests

@app.route('/api/environment/suggestion', methods=['POST'])
def get_ai_suggestion():
    try:
        data = request.get_json()
        temperature = data.get('temperature')
        humidity = data.get('humidity')
        motion_count = data.get('motion_count', 0)
        comfort_score = data.get('comfort_score', 0)
        
        KIMI_API_KEY = os.environ.get('KIMI_API_KEY', 'sk-k18zgUf8qdwh9TWS3JeUj6R76oq8r4Sa5txIlha9oWx4HwgE')
        
        prompt = f"""
        你是一个专业的睡眠环境专家。请根据以下实时环境数据，为用户提供专业的睡眠环境优化建议：
        
        当前环境数据：
        - 温度: {temperature}°C
        - 湿度: {humidity}%
        - 体动次数: {motion_count}次
        - 舒适指数: {comfort_score}分
        
        理想睡眠环境标准：
        - 温度: 18-24°C
        - 湿度: 40-60%
        - 体动次数越少越好
        
        请按照以下格式输出建议，用中文：
        [建议1]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因
        
        [建议2]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因
        
        [建议3]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因
        
        请给出3条最相关的建议，每条建议针对一个具体问题。
        """
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {KIMI_API_KEY}'
        }
        
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "你是一个专业的睡眠环境优化专家，善于根据实时数据给出精准的改善建议。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 800,
            "temperature": 0.7
        }
        
        response = requests.post('https://api.moonshot.cn/v1/chat/completions', headers=headers, json=payload)
        result = response.json()
        
        if response.status_code == 200 and result.get('choices'):
            content = result['choices'][0]['message']['content']
            suggestions = parse_suggestions(content)
            return jsonify({'success': True, 'suggestions': suggestions})
        else:
            fallback_suggestions = generate_fallback_suggestions(temperature, humidity, motion_count, comfort_score)
            return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})
            
    except Exception as e:
        temperature = data.get('temperature', 22) if data else 22
        humidity = data.get('humidity', 50) if data else 50
        motion_count = data.get('motion_count', 0) if data else 0
        comfort_score = data.get('comfort_score', 0) if data else 0
        fallback_suggestions = generate_fallback_suggestions(temperature, humidity, motion_count, comfort_score)
        return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})

def parse_suggestions(content):
    suggestions = []
    lines = content.split('\n')
    current_suggestion = {}
    
    for line in lines:
        line = line.strip()
        if line.startswith('[建议') and line.endswith(']'):
            if current_suggestion:
                suggestions.append(current_suggestion)
            current_suggestion = {}
        elif line.startswith('标题：'):
            current_suggestion['title'] = line[3:]
        elif line.startswith('级别：'):
            current_suggestion['level'] = line[3:]
        elif line.startswith('说明：'):
            current_suggestion['desc'] = line[3:]
    
    if current_suggestion:
        suggestions.append(current_suggestion)
    
    return suggestions[:3]

def generate_fallback_suggestions(temperature, humidity, motion_count, comfort_score):
    suggestions = []
    
    if temperature < 18:
        suggestions.append({
            'title': '温度偏低',
            'level': '需改善',
            'desc': f'当前室温{temperature:.1f}°C，低于理想睡眠温度范围(18-24°C)，建议适当提高室温或增加被褥'
        })
    elif temperature > 24:
        suggestions.append({
            'title': '温度偏高',
            'level': '需改善',
            'desc': f'当前室温{temperature:.1f}°C，高于理想睡眠温度范围(18-24°C)，建议开启空调或风扇降温'
        })
    else:
        suggestions.append({
            'title': '温度适宜',
            'level': '最佳',
            'desc': f'当前室温{temperature:.1f}°C，处于理想睡眠温度范围(18-24°C)内'
        })
    
    if humidity < 40:
        suggestions.append({
            'title': '湿度偏低',
            'level': '注意',
            'desc': f'当前湿度{humidity:.1f}%，低于理想范围(40-60%)，建议使用加湿器增加空气湿度'
        })
    elif humidity > 60:
        suggestions.append({
            'title': '湿度偏高',
            'level': '注意',
            'desc': f'当前湿度{humidity:.1f}%，高于理想范围(40-60%)，建议开启除湿功能或开窗通风'
        })
    else:
        suggestions.append({
            'title': '湿度适宜',
            'level': '最佳',
            'desc': f'当前湿度{humidity:.1f}%，处于理想睡眠湿度范围(40-60%)内'
        })
    
    if motion_count > 15:
        suggestions.append({
            'title': '体动频繁',
            'level': '需改善',
            'desc': f'当前检测到{motion_count}次体动，建议检查睡眠姿势或调整床垫舒适度'
        })
    elif motion_count > 5:
        suggestions.append({
            'title': '体动正常',
            'level': '良好',
            'desc': f'当前检测到{motion_count}次体动，属于正常范围'
        })
    else:
        suggestions.append({
            'title': '睡眠安静',
            'level': '最佳',
            'desc': '体动次数很少，睡眠状态非常稳定'
        })
    
    return suggestions[:3]

@app.route('/api/respiration/suggestion', methods=['POST'])
def get_respiration_ai_suggestion():
    try:
        data = request.get_json()
        avg_respiration = data.get('avgRespiration')
        quality_score = data.get('qualityScore', 0)
        has_alerts = data.get('hasAlerts', False)
        
        KIMI_API_KEY = os.environ.get('KIMI_API_KEY', 'sk-k18zgUf8qdwh9TWS3JeUj6R76oq8r4Sa5txIlha9oWx4HwgE')
        
        prompt = f"""
        你是一个专业的睡眠呼吸监测专家。请根据以下呼吸监测数据，为用户提供专业的呼吸健康建议：

        当前监测数据：
        - 平均呼吸率: {avg_respiration if avg_respiration else '暂无数据'} 次/分
        - 信号质量评分: {quality_score} 分
        - 是否有异常记录: {'是' if has_alerts else '否'}

        正常呼吸率范围：12-20次/分

        请按照以下格式输出建议，用中文：
        [建议1]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        [建议2]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        [建议3]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        请给出3条最相关的建议，每条建议针对一个具体问题。
        """
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {KIMI_API_KEY}'
        }
        
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "你是一个专业的睡眠呼吸监测专家，善于根据呼吸数据给出精准的健康建议。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 800,
            "temperature": 0.7
        }
        
        response = requests.post('https://api.moonshot.cn/v1/chat/completions', headers=headers, json=payload)
        result = response.json()
        
        if response.status_code == 200 and result.get('choices'):
            content = result['choices'][0]['message']['content']
            suggestions = parse_suggestions(content)
            return jsonify({'success': True, 'suggestions': suggestions})
        else:
            fallback_suggestions = generate_respiration_fallback_suggestions(avg_respiration, quality_score, has_alerts)
            return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})
            
    except Exception as e:
        data = request.get_json() if request.is_json else {}
        avg_respiration = data.get('avgRespiration')
        quality_score = data.get('qualityScore', 0)
        has_alerts = data.get('hasAlerts', False)
        fallback_suggestions = generate_respiration_fallback_suggestions(avg_respiration, quality_score, has_alerts)
        return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})

def generate_respiration_fallback_suggestions(avg_respiration, quality_score, has_alerts):
    suggestions = []
    
    if avg_respiration:
        if avg_respiration < 12:
            suggestions.append({
                'title': '呼吸率偏低',
                'level': '需改善',
                'desc': f'当前呼吸率{avg_respiration}次/分，低于正常范围(12-20)，建议监测呼吸状态，必要时咨询医生'
            })
        elif avg_respiration > 20:
            suggestions.append({
                'title': '呼吸率偏高',
                'level': '需改善',
                'desc': f'当前呼吸率{avg_respiration}次/分，高于正常范围(12-20)，建议放松并保持平静呼吸'
            })
        else:
            suggestions.append({
                'title': '呼吸率正常',
                'level': '最佳',
                'desc': f'当前呼吸率{avg_respiration}次/分，处于健康范围(12-20)，保持规律呼吸'
            })
    else:
        suggestions.append({
            'title': '等待数据',
            'level': '良好',
            'desc': '请确保ESP32设备已连接并开始采集呼吸数据'
        })
    
    if has_alerts:
        suggestions.append({
            'title': '存在异常记录',
            'level': '需改善',
            'desc': '检测到呼吸异常记录，建议关注并保持监测'
        })
    
    if quality_score < 50:
        suggestions.append({
            'title': '信号质量较低',
            'level': '注意',
            'desc': '当前质量评分偏低，建议减少环境干扰或调整设备位置'
        })
    
    if len(suggestions) < 2:
        suggestions.append({
            'title': '持续监测中',
            'level': '最佳',
            'desc': '正在积累呼吸数据，系统将持续分析睡眠呼吸模式'
        })
    
    return suggestions[:3]

@app.route('/api/sleep/suggestion', methods=['POST'])
def get_sleep_ai_suggestion():
    try:
        data = request.get_json()
        duration = data.get('duration')
        score = data.get('score')
        deepSleep = data.get('deepSleep')
        lightSleep = data.get('lightSleep')
        remSleep = data.get('remSleep')
        efficiency = data.get('efficiency')
        avgRespiration = data.get('avgRespiration')
        
        KIMI_API_KEY = os.environ.get('KIMI_API_KEY', 'sk-k18zgUf8qdwh9TWS3JeUj6R76oq8r4Sa5txIlha9oWx4HwgE')
        
        prompt = f"""
        你是一个专业的睡眠健康专家。请根据以下睡眠数据，为用户提供专业的睡眠改善建议：

        当前睡眠数据：
        - 睡眠时长: {duration if duration else '暂无'} 小时
        - 睡眠评分: {score} 分
        - 深睡眠: {deepSleep if deepSleep else '暂无'} 小时
        - 浅睡眠: {lightSleep if lightSleep else '暂无'} 小时
        - REM期: {remSleep if remSleep else '暂无'} 小时
        - 睡眠效率: {efficiency if efficiency else '暂无'} %
        - 平均呼吸率: {avgRespiration if avgRespiration else '暂无'} 次/分

        睡眠健康标准：
        - 成年人建议睡眠时长：7-9小时
        - 深睡眠占比：20-40%
        - REM期占比：10-25%
        - 睡眠效率：≥85%为良好

        请按照以下格式输出建议，用中文：
        [建议1]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        [建议2]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        [建议3]
        标题：简洁的标题
        级别：最佳/良好/注意/需改善/急需改善
        说明：详细的改善建议和原因

        请给出3条最相关的建议，每条建议针对一个具体问题。
        """
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {KIMI_API_KEY}'
        }
        
        payload = {
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "你是一个专业的睡眠健康专家，善于根据睡眠数据给出精准的改善建议。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 800,
            "temperature": 0.7
        }
        
        response = requests.post('https://api.moonshot.cn/v1/chat/completions', headers=headers, json=payload)
        result = response.json()
        
        if response.status_code == 200 and result.get('choices'):
            content = result['choices'][0]['message']['content']
            suggestions = parse_suggestions(content)
            return jsonify({'success': True, 'suggestions': suggestions})
        else:
            fallback_suggestions = generate_sleep_fallback_suggestions(duration, score, deepSleep, lightSleep, remSleep, efficiency, avgRespiration)
            return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})
            
    except Exception as e:
        data = request.get_json() if request.is_json else {}
        duration = data.get('duration')
        score = data.get('score')
        deepSleep = data.get('deepSleep')
        lightSleep = data.get('lightSleep')
        remSleep = data.get('remSleep')
        efficiency = data.get('efficiency')
        avgRespiration = data.get('avgRespiration')
        fallback_suggestions = generate_sleep_fallback_suggestions(duration, score, deepSleep, lightSleep, remSleep, efficiency, avgRespiration)
        return jsonify({'success': True, 'suggestions': fallback_suggestions, 'fallback': True})

def generate_sleep_fallback_suggestions(duration, score, deepSleep, lightSleep, remSleep, efficiency, avgRespiration):
    suggestions = []
    
    if duration:
        if duration < 7:
            suggestions.append({
                'title': '睡眠时长不足',
                'level': '需改善',
                'desc': f'当前睡眠时长{duration}小时，建议成年人保证7-9小时睡眠，可适当提前入睡时间'
            })
        elif duration > 9:
            suggestions.append({
                'title': '睡眠时长偏长',
                'level': '注意',
                'desc': f'当前睡眠时长{duration}小时，过长睡眠可能影响日间精神状态，建议适当调整作息'
            })
        else:
            suggestions.append({
                'title': '睡眠时长适宜',
                'level': '最佳',
                'desc': f'当前睡眠时长{duration}小时，处于成年人理想范围(7-9小时)，继续保持'
            })
    else:
        suggestions.append({
            'title': '等待数据',
            'level': '良好',
            'desc': '请完成一次完整的睡眠监测以获取睡眠建议'
        })
    
    if score:
        if score < 60:
            suggestions.append({
                'title': '睡眠质量较差',
                'level': '急需改善',
                'desc': f'当前睡眠评分{score}分，建议改善睡眠环境，保持规律作息'
            })
        elif score < 80:
            suggestions.append({
                'title': '睡眠质量一般',
                'level': '需改善',
                'desc': f'当前睡眠评分{score}分，还有提升空间，建议关注深睡眠比例'
            })
        elif score >= 90:
            suggestions.append({
                'title': '睡眠质量优秀',
                'level': '最佳',
                'desc': f'当前睡眠评分{score}分，睡眠质量非常好，继续保持健康作息'
            })
    
    if efficiency and efficiency < 85:
        suggestions.append({
            'title': '睡眠效率偏低',
            'level': '注意',
            'desc': f'当前睡眠效率{efficiency}%，建议减少卧床时间，提高入睡速度'
        })
    
    totalSleep = (deepSleep or 0) + (lightSleep or 0) + (remSleep or 0)
    if totalSleep > 0 and deepSleep:
        deepPercent = (deepSleep / totalSleep) * 100
        if deepPercent < 20:
            suggestions.append({
                'title': '深睡眠不足',
                'level': '需改善',
                'desc': f'深睡眠占比{deepPercent:.0f}%，建议睡前放松，创造安静环境以增加深睡眠'
            })
    
    if len(suggestions) < 3:
        suggestions.append({
            'title': '规律作息',
            'level': '最佳',
            'desc': '保持规律的作息时间有助于建立稳定的睡眠节律'
        })
    
    return suggestions[:3]

@app.route('/api/user/<int:user_id>/devices', methods=['GET'])
def get_devices(user_id):
    devices = Device.query.filter_by(user_id=user_id).all()
    
    return jsonify({
        'success': True,
        'devices': [{
            'id': d.id,
            'deviceId': d.device_id,
            'name': d.name,
            'status': d.status,
            'battery': d.battery,
            'signal': d.signal,
            'sampleRate': d.sample_rate,
            'signalThreshold': d.signal_threshold,
            'alertEnabled': d.alert_enabled,
            'uploadEnabled': d.upload_enabled
        } for d in devices]
    })

@app.route('/api/user/<int:user_id>/devices', methods=['POST'])
def add_device(user_id):
    data = request.get_json()
    
    device = Device(
        device_id=data.get('deviceId'),
        name=data.get('name'),
        user_id=user_id,
        status='offline'
    )
    
    db.session.add(device)
    db.session.commit()
    
    return jsonify({'success': True, 'message': '设备添加成功'})

@app.route('/api/device/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    device = Device.query.get_or_404(device_id)
    db.session.delete(device)
    db.session.commit()
    
    return jsonify({'success': True, 'message': '设备删除成功'})

@app.route('/api/device/<int:device_id>/config', methods=['PUT'])
def update_device_config(device_id):
    device = Device.query.get_or_404(device_id)
    data = request.get_json()
    
    device.name = data.get('name', device.name)
    device.sample_rate = data.get('sampleRate', device.sample_rate)
    device.signal_threshold = data.get('signalThreshold', device.signal_threshold)
    device.alert_enabled = data.get('alertEnabled', device.alert_enabled)
    device.upload_enabled = data.get('uploadEnabled', device.upload_enabled)
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': '配置更新成功'})

@app.route('/api/user/<int:user_id>/sleep-records', methods=['GET'])
def get_sleep_records(user_id):
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    
    query = SleepRecord.query.filter_by(user_id=user_id)
    
    if start_date:
        query = query.filter(SleepRecord.start_time >= start_date)
    if end_date:
        query = query.filter(SleepRecord.start_time <= end_date)
    
    records = query.order_by(SleepRecord.start_time.desc()).all()
    
    return jsonify({
        'success': True,
        'records': [{
            'id': r.id,
            'date': r.start_time.strftime('%Y-%m-%d'),
            'startTime': r.start_time.strftime('%H:%M'),
            'endTime': r.end_time.strftime('%H:%M') if r.end_time else None,
            'duration': r.duration,
            'efficiency': r.efficiency,
            'score': r.score,
            'deepSleep': r.deep_sleep,
            'lightSleep': r.light_sleep,
            'remSleep': r.rem_sleep
        } for r in records]
    })

def generate_sleep_suggestion(sleep_record):
    suggestions = []
    tags = []
    
    if not sleep_record:
        return {
            'content': '建议保持规律作息，每晚保证7-8小时睡眠。',
            'tags': ['规律作息']
        }
    
    duration = sleep_record.duration or 0
    score = sleep_record.score or 0
    deep = sleep_record.deep_sleep or 0
    light = sleep_record.light_sleep or 0
    rem = sleep_record.rem_sleep or 0
    
    if duration < 7:
        suggestions.append(f'您昨晚睡眠时长为{duration:.1f}小时，建议增加睡眠时间至7-8小时。')
        tags.append('增加睡眠')
    elif duration > 9:
        suggestions.append(f'您昨晚睡眠时长为{duration:.1f}小时，睡眠过多可能影响日间精神状态。')
        tags.append('调整时长')
    else:
        suggestions.append(f'您昨晚睡眠时长{duration:.1f}小时，处于健康范围内。')
    
    if score < 60:
        suggestions.append('您的睡眠质量有待提高，建议改善睡眠环境。')
        tags.append('改善环境')
    elif score >= 80:
        suggestions.append('您的睡眠质量很好，继续保持！')
        tags.append('保持状态')
    
    if deep < 1.5:
        suggestions.append('深睡眠时间较少，建议睡前避免使用电子设备。')
        tags.append('深睡眠')
    
    if rem < 0.5:
        suggestions.append('REM睡眠较少，可能影响记忆力和情绪调节。')
        tags.append('REM睡眠')
    
    avg_hr = 0
    avg_rr = 0
    if sleep_record.id:
        resp = Respiration.query.filter_by(user_id=sleep_record.user_id)\
            .filter(Respiration.timestamp >= sleep_record.start_time)\
            .filter(Respiration.timestamp <= (sleep_record.end_time or datetime.now()))\
            .all()
        if resp:
            avg_rr = sum(r.respiration_rate for r in resp) / len(resp)
    
    if avg_rr > 20:
        suggestions.append('夜间呼吸频率偏高，建议放松身心后入睡。')
        tags.append('呼吸频率')
    
    content = ' '.join(suggestions) if suggestions else '您的睡眠状态良好，请继续保持健康的作息习惯。'
    
    return {
        'content': content,
        'tags': list(set(tags))[:5]
    }


@app.route('/api/user/<int:user_id>/dashboard', methods=['GET'])
def get_dashboard(user_id):
    recent_record = SleepRecord.query.filter_by(user_id=user_id)\
        .order_by(SleepRecord.start_time.desc()).first()
    
    alerts_count = Alert.query.filter_by(user_id=user_id, status='unhandled').count()
    
    week_ago = datetime.now() - timedelta(days=7)
    week_records = SleepRecord.query.filter(
        SleepRecord.user_id == user_id,
        SleepRecord.start_time >= week_ago
    ).all()
    
    avg_duration = sum(r.duration or 0 for r in week_records) / len(week_records) if week_records else 0
    avg_score = sum(r.score or 0 for r in week_records) / len(week_records) if week_records else 0
    
    # 最近一次测试会话
    latest_session = _get_latest_session(user_id)
    avg_respiration = sum(r.respiration_rate for r in latest_session) / len(latest_session) if latest_session else 16

    # 波形数据：最近会话的数据点（从旧到新）
    resp_list = list(reversed(latest_session))
    respiration_data = [r.respiration_rate for r in resp_list] if resp_list else [16] * 12

    alerts = Alert.query.filter_by(user_id=user_id)\
        .order_by(Alert.created_at.desc()).limit(5).all()
    
    suggestion = generate_sleep_suggestion(recent_record)
    
    quick_stats = {}
    if recent_record:
        quick_stats['wakeTime'] = recent_record.end_time.strftime('%H:%M') if recent_record.end_time else '07:00'
        quick_stats['sleepTime'] = recent_record.start_time.strftime('%H:%M') if recent_record.start_time else '23:00'
        quick_stats['efficiency'] = int(recent_record.efficiency) if recent_record.efficiency else 85
    
    sleep_distribution = {
        'deep': recent_record.deep_sleep if recent_record else 2.5,
        'light': recent_record.light_sleep if recent_record else 4.0,
        'rem': recent_record.rem_sleep if recent_record else 1.0,
        'awake': (recent_record.duration or 7.5) - (recent_record.deep_sleep or 2.5) - (recent_record.light_sleep or 4.0) - (recent_record.rem_sleep or 1.0)
    }
    
    week_days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    week_data = []
    today = datetime.now().weekday()
    for i in range(7):
        day_offset = today - i
        day_start = (datetime.now() - timedelta(days=i)).replace(hour=0, minute=0, second=0)
        day_end = day_start + timedelta(days=1)
        record = SleepRecord.query.filter(
            SleepRecord.user_id == user_id,
            SleepRecord.start_time >= day_start,
            SleepRecord.start_time < day_end
        ).first()
        week_data.append(record.duration if record else 7.0)
    
    week_data.reverse()
    
    return jsonify({
        'success': True,
        'data': {
            'sleepDuration': recent_record.duration if recent_record else 7.5,
            'avgRespiration': round(avg_respiration, 1),
            'sleepScore': int(avg_score) if avg_score else 85,
            'alertsCount': alerts_count,
            'trend': {
                'sleepDuration': week_data,
                'days': week_days
            },
            'sleepDistribution': sleep_distribution,
            'respirationData': respiration_data,
            'suggestion': suggestion if suggestion else {
                'content': '建议保持规律作息，每晚保证7-8小时睡眠。',
                'tags': ['规律作息']
            },
            'quickStats': quick_stats if quick_stats else {
                'wakeTime': '06:30',
                'sleepTime': '23:45',
                'efficiency': 87
            },
            'recentRecord': {
                'id': recent_record.id if recent_record else None,
                'startTime': recent_record.start_time.isoformat() if recent_record else None,
                'endTime': recent_record.end_time.isoformat() if recent_record else None,
                'duration': recent_record.duration if recent_record else None,
                'score': recent_record.score if recent_record else None,
                'deepSleep': recent_record.deep_sleep if recent_record else None,
                'lightSleep': recent_record.light_sleep if recent_record else None,
                'remSleep': recent_record.rem_sleep if recent_record else None
            } if recent_record else None,
            'alerts': [{
                'id': a.id,
                'type': a.alert_type,
                'level': a.level,
                'message': a.message,
                'time': a.created_at.strftime('%Y-%m-%d %H:%M'),
                'status': a.status
            } for a in alerts]
        }
    })

@app.route('/api/user/<int:user_id>/alerts', methods=['GET'])
def get_alerts(user_id):
    status = request.args.get('status', 'all')
    
    query = Alert.query.filter_by(user_id=user_id)
    if status != 'all':
        query = query.filter_by(status=status)
    
    alerts = query.order_by(Alert.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'alerts': [{
            'id': a.id,
            'type': a.alert_type,
            'level': a.level,
            'message': a.message,
            'deviceId': a.device_id,
            'time': a.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'status': a.status
        } for a in alerts]
    })

@app.route('/api/alert/<int:alert_id>', methods=['PUT', 'DELETE'])
def handle_alert(alert_id):
    alert = Alert.query.get_or_404(alert_id)
    
    if request.method == 'PUT':
        alert.status = 'handled'
        db.session.commit()
        return jsonify({'success': True, 'message': '告警已处理'})
    else:
        db.session.delete(alert)
        db.session.commit()
        return jsonify({'success': True, 'message': '告警已删除'})

@app.route('/api/user/<int:user_id>/alert-settings', methods=['GET', 'PUT'])
def alert_settings(user_id):
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'settings': {
                'respirationThreshold': 12,
                'apneaDuration': 10,
                'emailNotify': True,
                'smsNotify': False,
                'pushNotify': True
            }
        })
    else:
        data = request.get_json()
        return jsonify({'success': True, 'message': '设置保存成功'})

@app.route('/api/user/<int:user_id>/system-settings', methods=['GET', 'PUT'])
def system_settings(user_id):
    if request.method == 'GET':
        return jsonify({
            'success': True,
            'settings': {
                'sampleRate': 100,
                'autoReport': True,
                'realtimePush': True,
                'dataRetention': 90
            }
        })
    else:
        data = request.get_json()
        return jsonify({'success': True, 'message': '设置保存成功'})


@app.route('/api/user/<int:user_id>/alarms', methods=['GET'])
def get_alarms(user_id):
    alarms = Alarm.query.filter_by(user_id=user_id).order_by(Alarm.time).all()
    
    return jsonify({
        'success': True,
        'alarms': [{
            'id': a.id,
            'title': a.title,
            'time': a.time.strftime('%H:%M'),
            'enabled': a.enabled,
            'repeatDays': a.repeat_days.split(',') if a.repeat_days else [],
            'sound': a.sound,
            'createdAt': a.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'lastTriggered': a.last_triggered.strftime('%Y-%m-%d %H:%M:%S') if a.last_triggered else None
        } for a in alarms]
    })


@app.route('/api/user/<int:user_id>/alarms', methods=['POST'])
def add_alarm(user_id):
    data = request.get_json()
    
    alarm = Alarm(
        user_id=user_id,
        title=data.get('title', '闹钟'),
        time=datetime.strptime(data.get('time', '07:00'), '%H:%M').time(),
        enabled=data.get('enabled', True),
        repeat_days=','.join(data.get('repeatDays', [])),
        sound=data.get('sound', 'default')
    )
    
    db.session.add(alarm)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '闹钟添加成功',
        'alarm': {
            'id': alarm.id,
            'title': alarm.title,
            'time': alarm.time.strftime('%H:%M'),
            'enabled': alarm.enabled,
            'repeatDays': alarm.repeat_days.split(',') if alarm.repeat_days else [],
            'sound': alarm.sound
        }
    })


@app.route('/api/alarm/<int:alarm_id>', methods=['PUT'])
def update_alarm(alarm_id):
    alarm = Alarm.query.get_or_404(alarm_id)
    data = request.get_json()
    
    if 'title' in data:
        alarm.title = data['title']
    if 'time' in data:
        alarm.time = datetime.strptime(data['time'], '%H:%M').time()
    if 'enabled' in data:
        alarm.enabled = data['enabled']
    if 'repeatDays' in data:
        alarm.repeat_days = ','.join(data['repeatDays'])
    if 'sound' in data:
        alarm.sound = data['sound']
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '闹钟更新成功',
        'alarm': {
            'id': alarm.id,
            'title': alarm.title,
            'time': alarm.time.strftime('%H:%M'),
            'enabled': alarm.enabled,
            'repeatDays': alarm.repeat_days.split(',') if alarm.repeat_days else [],
            'sound': alarm.sound
        }
    })


@app.route('/api/alarm/<int:alarm_id>', methods=['DELETE'])
def delete_alarm(alarm_id):
    alarm = Alarm.query.get_or_404(alarm_id)
    db.session.delete(alarm)
    db.session.commit()
    
    return jsonify({'success': True, 'message': '闹钟已删除'})


@app.route('/api/alarm/<int:alarm_id>/toggle', methods=['PUT'])
def toggle_alarm(alarm_id):
    alarm = Alarm.query.get_or_404(alarm_id)
    alarm.enabled = not alarm.enabled
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '闹钟状态已更新',
        'enabled': alarm.enabled
    })

@app.route('/api/device/<device_id>/csi-data', methods=['POST'])
def receive_csi_data(device_id):
    """Receive processed respiration data from mqtt_processor."""
    data = request.get_json()

    user_id = data.get('user_id', 1)
    bpm = data.get('bpm', 0)
    confidence = data.get('confidence', 0)
    motion_detected = data.get('motion_detected', False)
    sleep_state = data.get('sleep_state', 'unknown')
    ts_str = data.get('timestamp')

    ts = datetime.fromisoformat(ts_str) if ts_str else datetime.now()

    respiration = Respiration(
        user_id=user_id,
        device_id=device_id,
        respiration_rate=bpm,
        confidence=confidence,
        motion_detected=motion_detected,
        sleep_state=sleep_state,
        timestamp=ts,
    )
    db.session.add(respiration)

    # Update device status to online
    device = Device.query.filter_by(device_id=device_id).first()
    if device:
        device.status = 'online'

    db.session.commit()

    return jsonify({'success': True, 'message': '数据已接收'})


@app.route('/api/device/<device_id>/env-data', methods=['POST'])
def receive_env_data(device_id):
    """Receive environment data from mqtt_processor."""
    data = request.get_json()

    user_id = data.get('user_id', 1)
    temperature = data.get('temperature', 0)
    humidity = data.get('humidity', 0)
    ts_str = data.get('timestamp')
    ts = datetime.fromisoformat(ts_str) if ts_str else datetime.now()

    record = EnvironmentRecord(
        user_id=user_id,
        device_id=device_id,
        temperature=temperature,
        humidity=humidity,
        timestamp=ts,
    )
    db.session.add(record)
    db.session.commit()

    return jsonify({'success': True, 'message': '环境数据已接收'})


@app.route('/api/environment/current', methods=['GET'])
def environment_current():
    """返回最新温湿度数据"""
    user_id = request.args.get('userId', 1, type=int)
    latest = EnvironmentRecord.query.filter_by(user_id=user_id)\
        .order_by(EnvironmentRecord.timestamp.desc()).first()

    if latest:
        return jsonify({
            'success': True,
            'data': {
                'temperature': round(latest.temperature, 1),
                'humidity': round(latest.humidity, 1),
                'timestamp': latest.timestamp.isoformat(),
            }
        })
    return jsonify({'success': True, 'data': None})


@app.route('/api/environment/trend', methods=['GET'])
def environment_trend():
    """返回指定日期24小时整点平均温湿度"""
    user_id = request.args.get('userId', 1, type=int)
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))

    day_start = datetime.strptime(date_str, '%Y-%m-%d')
    times = []
    temps = []
    hums = []

    for h in range(24):
        h_start = day_start + timedelta(hours=h)
        h_end = h_start + timedelta(hours=1)
        records = EnvironmentRecord.query.filter_by(user_id=user_id)\
            .filter(EnvironmentRecord.timestamp >= h_start, EnvironmentRecord.timestamp < h_end)\
            .all()
        times.append(f'{h:02d}:00')
        if records:
            temps.append(round(sum(r.temperature for r in records) / len(records), 1))
            hums.append(round(sum(r.humidity for r in records) / len(records), 1))
        else:
            temps.append(None)
            hums.append(None)

    return jsonify({
        'success': True,
        'data': {'times': times, 'temperatures': temps, 'humidities': hums}
    })


# ============================================================
# Mobile APP API endpoints (sleep-monitor-app)
# ============================================================

@app.route('/api/user/<int:user_id>/respiration/real-time', methods=['GET'])
def mobile_respiration_realtime(user_id):
    """Mobile: latest respiration rate from most recent session."""
    session = _get_latest_session(user_id)
    if session:
        latest = session[0]  # newest record
        avg_br = sum(r.respiration_rate for r in session) / len(session)
        return jsonify({
            'success': True,
            'data': {
                'value': round(latest.respiration_rate, 1),
                'avgBpm': round(avg_br, 1),
                'confidence': round(latest.confidence or 0, 2),
                'motionDetected': bool(latest.motion_detected),
                'sleepState': latest.sleep_state or 'unknown',
                'timestamp': latest.timestamp.isoformat(),
                'sessionCount': len(session),
            }
        })
    return jsonify({'success': True, 'data': None})


@app.route('/api/user/<int:user_id>/respiration/records', methods=['GET'])
def mobile_respiration_records(user_id):
    """Mobile: paginated respiration records."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    offset = (page - 1) * limit

    total = Respiration.query.filter_by(user_id=user_id).count()
    records = Respiration.query.filter_by(user_id=user_id)\
        .order_by(Respiration.timestamp.desc())\
        .offset(offset).limit(limit).all()

    return jsonify({
        'success': True,
        'data': [{
            'id': r.id,
            'respirationRate': round(r.respiration_rate, 1),
            'confidence': round(r.confidence or 0, 2),
            'motionDetected': bool(r.motion_detected),
            'sleepState': r.sleep_state or 'unknown',
            'timestamp': r.timestamp.isoformat(),
        } for r in records],
        'total': total,
        'page': page,
        'limit': limit,
    })


@app.route('/api/user/<int:user_id>/environment', methods=['GET'])
def mobile_environment(user_id):
    """Mobile: latest environment data."""
    latest = EnvironmentRecord.query.filter_by(user_id=user_id)\
        .order_by(EnvironmentRecord.timestamp.desc()).first()

    if latest:
        # Motion count from recent respiration
        recent_motion = Respiration.query.filter_by(user_id=user_id)\
            .filter(Respiration.timestamp >= datetime.now() - timedelta(hours=24))\
            .filter(Respiration.motion_detected == True).count()
        return jsonify({
            'success': True,
            'data': {
                'temperature': round(latest.temperature, 1),
                'humidity': round(latest.humidity, 1),
                'comfort_score': 85,
                'motion_count': recent_motion,
                'timestamp': latest.timestamp.isoformat(),
            }
        })
    return jsonify({'success': True, 'data': None})


@app.route('/api/user/<int:user_id>/environment/history', methods=['GET'])
def mobile_environment_history(user_id):
    """Mobile: daily average environment for last N days."""
    days = request.args.get('days', 7, type=int)
    data = []
    for i in range(days - 1, -1, -1):
        day_start = (datetime.now() - timedelta(days=i)).replace(hour=0, minute=0, second=0)
        day_end = day_start + timedelta(days=1)
        records = EnvironmentRecord.query.filter_by(user_id=user_id)\
            .filter(EnvironmentRecord.timestamp >= day_start, EnvironmentRecord.timestamp < day_end)\
            .all()
        if records:
            data.append({
                'date': day_start.strftime('%m-%d'),
                'avgTemperature': round(sum(r.temperature for r in records) / len(records), 1),
                'avgHumidity': round(sum(r.humidity for r in records) / len(records), 1),
            })
        else:
            data.append({
                'date': day_start.strftime('%m-%d'),
                'avgTemperature': None,
                'avgHumidity': None,
            })
    return jsonify({'success': True, 'data': data})


@app.route('/api/user/<int:user_id>/sleep-suggestion', methods=['GET'])
def mobile_sleep_suggestion(user_id):
    """Mobile: generate sleep suggestions from recent data."""
    record = SleepRecord.query.filter_by(user_id=user_id)\
        .order_by(SleepRecord.start_time.desc()).first()
    session = _get_latest_session(user_id)
    avg_br = sum(r.respiration_rate for r in session) / len(session) if session else 16

    suggestions = []
    if record:
        dur = record.duration or 7.5
        if dur < 6:
            suggestions.append('您的睡眠时长偏短，建议保证每晚7-8小时睡眠')
        if record.deep_sleep and record.deep_sleep < 1.5:
            suggestions.append('深睡眠占比较低，建议睡前避免咖啡因和剧烈运动')
        if record.efficiency and record.efficiency < 80:
            suggestions.append('睡眠效率偏低，建议固定作息时间')
    if avg_br < 12:
        suggestions.append('平均呼吸率偏低，建议关注呼吸健康')
    elif avg_br > 20:
        suggestions.append('平均呼吸率偏高，建议睡前放松身心')
    if not suggestions:
        suggestions.append('整体睡眠状况良好，请继续保持规律作息')

    return jsonify({
        'success': True,
        'data': {'suggestions': suggestions[:4]}
    })


# Rate limiter for AI suggestions (per-user, in-memory)
_ai_last_call = {}  # {user_id: datetime_of_last_call}

@app.route('/api/user/<int:user_id>/generate-suggestions', methods=['POST'])
def generate_ai_suggestions(user_id):
    """Generate AI-powered suggestions using Kimi/Moonshot API. Rate limited to 1 per 10 min."""
    # Rate limit check
    if user_id in _ai_last_call:
        elapsed = (datetime.now() - _ai_last_call[user_id]).total_seconds()
        if elapsed < 600:
            return jsonify({
                'success': False,
                'message': f'请{600 - int(elapsed)}秒后再生成新建议',
                'retryAfter': 600 - int(elapsed),
            })

    data = request.get_json() or {}
    s_type = data.get('type', 'sleep')

    # Gather real data
    session = _get_latest_session(user_id)
    avg_br = sum(r.respiration_rate for r in session) / len(session) if session else 16
    latest_env = EnvironmentRecord.query.filter_by(user_id=user_id)\
        .order_by(EnvironmentRecord.timestamp.desc()).first()
    record = SleepRecord.query.filter_by(user_id=user_id)\
        .order_by(SleepRecord.start_time.desc()).first()

    if s_type == 'environment':
        temp = latest_env.temperature if latest_env else '未知'
        hum = latest_env.humidity if latest_env else '未知'
        prompt = f"""你是专业睡眠环境专家。请根据以下数据给出建议：

室温: {temp}°C, 湿度: {hum}%, 呼吸率: {avg_br}次/分

理想睡眠环境: 温度18-24°C, 湿度40-60%, 呼吸率12-20次/分。

请给出3条简洁建议(每条15字以内)，格式：建议1|建议2|建议3"""
    else:
        dur = record.duration if record else 7.5
        score = record.score if record else 85
        deep = record.deep_sleep if record else 2.5
        prompt = f"""你是专业睡眠健康专家。请根据以下数据给出建议：

睡眠时长: {dur}h, 评分: {score}, 深睡: {deep}h, 呼吸率: {avg_br}次/分

请给出3条简洁建议(每条15字以内)，格式：建议1|建议2|建议3"""

    try:
        KIMI_API_KEY = os.environ.get('KIMI_API_KEY', 'sk-k18zgUf8qdwh9TWS3JeUj6R76oq8r4Sa5txIlha9oWx4HwgE')
        resp = requests.post('https://api.moonshot.cn/v1/chat/completions', headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {KIMI_API_KEY}',
        }, json={
            "model": "moonshot-v1-8k",
            "messages": [
                {"role": "system", "content": "你是专业睡眠健康专家。只输出用|分隔的建议列表，每条建议不超过15个字。不要编号，不要额外文字。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 200,
            "temperature": 0.7,
        }, timeout=15)

        if resp.status_code == 200:
            body = resp.json()
            content = body['choices'][0]['message']['content']
            # Parse "|"-separated suggestions
            items = [s.strip() for s in content.replace('\n', '|').split('|') if s.strip()]
            suggestions = items[:4] if items else [f'基于数据: 呼吸率{avg_br}次/分, 建议保持规律作息']
        else:
            suggestions = [f'当前呼吸率{avg_br}次/分，保持规律作息', '睡前避免咖啡因和剧烈运动', '确保卧室温度18-24°C']
    except Exception:
        suggestions = [f'当前呼吸率{avg_br}次/分，保持规律作息', '睡前避免咖啡因和剧烈运动', '确保卧室温度18-24°C']

    _ai_last_call[user_id] = datetime.now()
    return jsonify({'success': True, 'suggestions': suggestions})


@app.route('/api/device/<device_id>/apnea-alert', methods=['POST'])
def receive_apnea_alert(device_id):
    """Receive apnea alert from mqtt_processor."""
    data = request.get_json()

    user_id = data.get('user_id', 1)
    event_type = data.get('event_type', 'apnea')
    duration = data.get('duration_sec', 0)

    level = 'P1' if event_type == 'apnea' and duration > 20 else 'P2'
    message = f"检测到{event_type}事件，持续{round(duration, 1)}秒"

    alert = Alert(
        user_id=user_id,
        device_id=device_id,
        alert_type='呼吸暂停' if event_type == 'apnea' else '低通气',
        level=level,
        message=message,
    )
    db.session.add(alert)
    db.session.commit()

    return jsonify({'success': True, 'message': '告警已创建'})


# ============================================================
# Respiration API endpoints (for Respiration.jsx page)
# ============================================================

SESSION_GAP_MINUTES = 5  # 两次采集间隔 > 5分钟 视为新会话


def _get_latest_session(user_id):
    """返回最近一次测试会话的所有 Respiration 记录。

    会话定义：时间连续的一组记录（相邻记录间隔 < SESSION_GAP_MINUTES）。
    向前回溯直到遇到超过阈值的间隔，则该间隔之后的记录属于同一个会话。
    """
    all_records = Respiration.query.filter_by(user_id=user_id)\
        .order_by(Respiration.timestamp.desc()).limit(500).all()

    if not all_records:
        return []

    session = [all_records[0]]
    for i in range(1, len(all_records)):
        gap = (session[-1].timestamp - all_records[i].timestamp).total_seconds()
        if gap > SESSION_GAP_MINUTES * 60:
            break  # 间隔太大，会话结束
        session.append(all_records[i])

    return session  # 从新到旧排列


@app.route('/api/respiration/data', methods=['GET'])
def respiration_data():
    """返回呼吸率监测当前数据"""
    user_id = request.args.get('userId', 1, type=int)

    # 最近一次测试会话的数据
    session = _get_latest_session(user_id)

    if session:
        avg_br = sum(r.respiration_rate for r in session) / len(session)
        avg_conf = sum(r.confidence or 0 for r in session) / len(session)
        motion_count = sum(1 for r in session if r.motion_detected)
        motion_ratio = motion_count / len(session)
        quality_score = int(max(30, min(95, avg_conf * 100 - motion_ratio * 30)))
    else:
        avg_br = 16
        quality_score = 0

    # Latest sleep record for distribution
    sleep_record = SleepRecord.query.filter_by(user_id=user_id)\
        .order_by(SleepRecord.start_time.desc()).first()

    if sleep_record:
        dur = sleep_record.duration or 7.5
        deep_h = sleep_record.deep_sleep or 2.5
        light_h = sleep_record.light_sleep or 4.0
        rem_h = sleep_record.rem_sleep or 1.0
    else:
        dur = 7.5
        deep_h, light_h, rem_h = 2.5, 4.0, 1.0

    return jsonify({
        'success': True,
        'data': {
            'avgRespiration': round(avg_br, 1),
            'sleepDistribution': {'deep': deep_h, 'light': light_h, 'rem': rem_h},
            'sleepDuration': round(dur, 1),
            'qualityScore': quality_score,
        }
    })


@app.route('/api/respiration/wave', methods=['GET'])
def respiration_wave():
    """返回最近一次测试会话的呼吸率数据点用于实时波形图"""
    user_id = request.args.get('userId', 1, type=int)

    session = _get_latest_session(user_id)

    if session:
        # Reverse to chronological order (oldest first)
        data = [round(r.respiration_rate, 1) for r in reversed(session)]
    else:
        data = []

    return jsonify({'success': True, 'data': data})


@app.route('/api/respiration/sleep-stage', methods=['GET'])
def respiration_sleep_stage():
    """返回各睡眠阶段的平均呼吸率"""
    user_id = request.args.get('userId', 1, type=int)
    date_str = request.args.get('date', '')

    # Latest sleep record
    query = SleepRecord.query.filter_by(user_id=user_id)
    if date_str:
        day_start = datetime.strptime(date_str, '%Y-%m-%d')
        day_end = day_start + timedelta(days=1)
        query = query.filter(SleepRecord.start_time >= day_start, SleepRecord.start_time < day_end)

    sleep_record = query.order_by(SleepRecord.start_time.desc()).first()

    if not sleep_record:
        return jsonify({
            'success': True,
            'data': {
                'totalSleep': 7.5,
                'deepSleep': {'hours': 2.5, 'avgRespiration': 12},
                'lightSleep': {'hours': 4.0, 'avgRespiration': 15},
                'remSleep': {'hours': 1.0, 'avgRespiration': 17},
                'awake': {'hours': 0.5, 'avgRespiration': 19},
            }
        })

    dur = sleep_record.duration or 7.5
    deep_h = sleep_record.deep_sleep or 2.5
    light_h = sleep_record.light_sleep or 4.0
    rem_h = sleep_record.rem_sleep or 1.0
    awake_h = max(0, dur - deep_h - light_h - rem_h)

    # Get respiration data during this sleep record
    resp_list = Respiration.query.filter_by(user_id=user_id)\
        .filter(Respiration.timestamp >= sleep_record.start_time)\
        .filter(Respiration.timestamp <= (sleep_record.end_time or datetime.now()))\
        .all()

    if resp_list:
        all_br = [r.respiration_rate for r in resp_list]
        avg_all = sum(all_br) / len(all_br)
        deep_br = round(max(10, avg_all - 4), 1)
        light_br = round(avg_all, 1)
        rem_br = round(min(22, avg_all + 2), 1)
        awake_br = round(min(25, avg_all + 4), 1)
    else:
        deep_br, light_br, rem_br, awake_br = 12, 15, 17, 19

    return jsonify({
        'success': True,
        'data': {
            'totalSleep': round(dur, 1),
            'deepSleep': {'hours': round(deep_h, 1), 'avgRespiration': deep_br},
            'lightSleep': {'hours': round(light_h, 1), 'avgRespiration': light_br},
            'remSleep': {'hours': round(rem_h, 1), 'avgRespiration': rem_br},
            'awake': {'hours': round(awake_h, 1), 'avgRespiration': awake_br},
        }
    })


@app.route('/api/respiration/trend', methods=['GET'])
def respiration_trend():
    """返回呼吸率历史趋势（日/周/月）"""
    user_id = request.args.get('userId', 1, type=int)
    mode = request.args.get('mode', 'day')
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))

    data = []
    now = datetime.now()
    month_label = f"{now.year}年{now.month}月"

    if mode == 'day':
        # Hourly averages for the given day
        day_start = datetime.strptime(date_str, '%Y-%m-%d')
        for h in range(24):
            h_start = day_start + timedelta(hours=h)
            h_end = h_start + timedelta(hours=1)
            records = Respiration.query.filter_by(user_id=user_id)\
                .filter(Respiration.timestamp >= h_start, Respiration.timestamp < h_end)\
                .all()
            if records:
                avg = sum(r.respiration_rate for r in records) / len(records)
                data.append({'time': f'{h:02d}:00', 'value': round(avg, 1)})
            else:
                data.append({'time': f'{h:02d}:00', 'value': None})

    elif mode == 'week':
        # Daily averages for the past 7 days
        for i in range(6, -1, -1):
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0)
            day_end = day_start + timedelta(days=1)
            records = Respiration.query.filter_by(user_id=user_id)\
                .filter(Respiration.timestamp >= day_start, Respiration.timestamp < day_end)\
                .all()
            day_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
            day_name = day_names[day_start.weekday()]
            if records:
                avg = sum(r.respiration_rate for r in records) / len(records)
                data.append({'time': day_name, 'value': round(avg, 1)})
            else:
                data.append({'time': day_name, 'value': None})

    elif mode == 'month':
        # Daily averages for all days of the current month
        import calendar
        first_day = now.replace(day=1, hour=0, minute=0, second=0)
        total_days = calendar.monthrange(now.year, now.month)[1]  # e.g. 30 for June
        for d in range(1, total_days + 1):
            day_start = first_day.replace(day=d)
            day_end = day_start + timedelta(days=1)
            # Only query data for days that have already passed
            if day_start <= now:
                records = Respiration.query.filter_by(user_id=user_id)\
                    .filter(Respiration.timestamp >= day_start, Respiration.timestamp < day_end)\
                    .all()
                if records:
                    avg = sum(r.respiration_rate for r in records) / len(records)
                    data.append({'time': f'{d}日', 'value': round(avg, 1)})
                else:
                    data.append({'time': f'{d}日', 'value': None})
            else:
                # Future days: no data yet
                data.append({'time': f'{d}日', 'value': None})

    return jsonify({'success': True, 'data': data, 'monthLabel': month_label})


@app.route('/api/respiration/alerts', methods=['GET'])
def respiration_alerts():
    """返回呼吸相关的异常告警"""
    user_id = request.args.get('userId', 1, type=int)
    date_str = request.args.get('date', '')

    query = Alert.query.filter_by(user_id=user_id)

    if date_str:
        day_start = datetime.strptime(date_str, '%Y-%m-%d')
        day_end = day_start + timedelta(days=1)
        query = query.filter(Alert.created_at >= day_start, Alert.created_at < day_end)

    # Only respiration-related alerts
    query = query.filter(
        Alert.alert_type.in_(['呼吸暂停', '低通气', '呼吸过缓', '呼吸过速'])
    ).order_by(Alert.created_at.desc()).limit(20)

    alerts = query.all()

    return jsonify({
        'success': True,
        'data': [{
            'type': a.alert_type,
            'time': a.created_at.strftime('%H:%M') if a.created_at else '',
            'level': a.level,
            'color': '#e07060' if a.level == 'P1' else '#e8a840',
            'message': a.message or '',
        } for a in alerts]
    })


def init_db():
    with app.app_context():
        db.create_all()
        
        if User.query.count() > 0:
            print("数据库已有数据，跳过初始化")
            return
        
        user = User(
            username='admin',
            password='123456',
            email='admin@example.com',
            phone='13800138000',
            age=25,
            height=175,
            weight=70
        )
        db.session.add(user)
        db.session.commit()
        
        device1 = Device(
            device_id='ESP-001',
            name='卧室监测设备',
            user_id=user.id,
            status='online',
            battery=85,
            signal=-65,
            sample_rate=100,
            signal_threshold=-60,
            alert_enabled=True,
            upload_enabled=True
        )
        device2 = Device(
            device_id='ESP-002',
            name='客厅监测设备',
            user_id=user.id,
            status='offline',
            battery=0,
            signal=None,
            sample_rate=100,
            signal_threshold=-60,
            alert_enabled=True,
            upload_enabled=True
        )
        db.session.add(device1)
        db.session.add(device2)
        db.session.commit()
        
        for i in range(7):
            start_time = datetime.now() - timedelta(days=i+1, hours=7)
            end_time = start_time + timedelta(hours=7.5)
            record = SleepRecord(
                user_id=user.id,
                device_id='ESP-001',
                start_time=start_time,
                end_time=end_time,
                duration=7.5,
                efficiency=85 + i,
                score=80 + i,
                deep_sleep=2.5,
                light_sleep=4.0,
                rem_sleep=1.0
            )
            db.session.add(record)
        
        alert1 = Alert(
            user_id=user.id,
            device_id='ESP-001',
            alert_type='呼吸暂停',
            level='P1',
            message='检测到呼吸暂停事件，持续12秒',
            status='handled'
        )
        alert2 = Alert(
            user_id=user.id,
            device_id='ESP-001',
            alert_type='呼吸过速',
            level='P2',
            message='呼吸率超过阈值: 22次/分钟',
            status='handled'
        )
        alert3 = Alert(
            user_id=user.id,
            device_id='ESP-001',
            alert_type='设备离线',
            level='P2',
            message='设备ESP-001离线',
            status='unhandled'
        )
        db.session.add(alert1)
        db.session.add(alert2)
        db.session.add(alert3)
        
        db.session.commit()
        print("数据库初始化完成，已添加示例数据")

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
